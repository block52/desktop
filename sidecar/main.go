// Command b52-wallet is the desktop app's wallet sidecar: a stateless,
// loopback-only crypto helper the Electron main process spawns and talks to
// over stdin/stdout as line-delimited JSON. It never opens a network port and
// never persists anything — the Electron side owns the sealed vault file and
// the OS keychain; this process only does the pure crypto (generate, derive,
// address, sign) using github.com/block52/pokerchain-go-client.
//
// Protocol: one JSON request per line in, one JSON response per line out.
//
//	{"id":1,"method":"address","mnemonic":"..."}            -> {"id":1,"result":{"address":"b52..."}}
//	{"id":2,"method":"generate","bits":256}                 -> {"id":2,"result":{"mnemonic":"...","address":"b52..."}}
//	{"id":3,"method":"validateMnemonic","mnemonic":"..."}   -> {"id":3,"result":{"valid":true}}
//	{"id":4,"method":"signQuery","mnemonic":"...","timestamp":123} -> {"id":4,"result":{"signature":"0x..."}}
//
// Errors come back as {"id":N,"error":"message"}.
package main

import (
	"bufio"
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/block52/pokerchain-go-client/chain"
	"github.com/block52/pokerchain-go-client/keys"
	"github.com/block52/pokerchain-go-client/lightnode"
	"github.com/block52/pokerchain-go-client/wallet"
	"github.com/block52/pokerchain-go-client/wire"
)

const addressPrefix = "b52"

type request struct {
	ID        int    `json:"id"`
	Method    string `json:"method"`
	Mnemonic  string `json:"mnemonic"`
	Bits      int    `json:"bits"`
	Timestamp int64  `json:"timestamp"`

	// broadcast: a game action signed as an ordered (account-sequence) tx and
	// sent to the node over gRPC. Kind is action|join|leave|topUp|send.
	GRPC    string `json:"grpc"`
	ChainID string `json:"chainId"`
	Kind    string `json:"kind"`
	GameID  string `json:"gameId"`
	Action  string `json:"action"`
	Amount  uint64 `json:"amount"`
	Data    string `json:"data"`
	Seat    uint64 `json:"seat"`
	BuyIn   uint64 `json:"buyIn"`
	// FinishingOrder is a Sit & Go claim's place-1-first player addresses (leave only).
	FinishingOrder []string `json:"finishingOrder"`

	// send (a bank transfer): Amount is in the denom's smallest unit. From is optional and, when given, must be
	// this wallet's own address; the sidecar only ever signs as the wallet it was given.
	From  string `json:"from"`
	To    string `json:"to"`
	Denom string `json:"denom"`

	// recentBlocks: the last-N-blocks window, polled from Tendermint RPC.
	RPC   string `json:"rpc"`
	Count int    `json:"count"`
}

type response struct {
	ID     int `json:"id"`
	Result any `json:"result,omitempty"`
	Error  string `json:"error,omitempty"`
}

func main() {
	in := bufio.NewScanner(os.Stdin)
	in.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()

	for in.Scan() {
		line := in.Bytes()
		if len(line) == 0 {
			continue
		}
		var req request
		if err := json.Unmarshal(line, &req); err != nil {
			writeResponse(out, response{Error: "bad request: " + err.Error()})
			continue
		}
		writeResponse(out, handle(req))
	}
}

func handle(req request) response {
	switch req.Method {
	case "generate":
		bits := req.Bits
		if bits == 0 {
			bits = 256
		}
		mnemonic, err := wallet.NewMnemonic(bits)
		if err != nil {
			return response{ID: req.ID, Error: err.Error()}
		}
		addr, err := wallet.Address(mnemonic, addressPrefix)
		if err != nil {
			return response{ID: req.ID, Error: err.Error()}
		}
		return response{ID: req.ID, Result: map[string]string{"mnemonic": mnemonic, "address": addr}}

	case "validateMnemonic":
		return response{ID: req.ID, Result: map[string]bool{"valid": wallet.IsValidMnemonic(req.Mnemonic)}}

	case "address":
		addr, err := wallet.Address(req.Mnemonic, addressPrefix)
		if err != nil {
			return response{ID: req.ID, Error: err.Error()}
		}
		return response{ID: req.ID, Result: map[string]string{"address": addr}}

	case "signQuery":
		if req.Timestamp <= 0 {
			return response{ID: req.ID, Error: "invalid timestamp"}
		}
		priv, err := wallet.PrivateKey(req.Mnemonic)
		if err != nil {
			return response{ID: req.ID, Error: err.Error()}
		}
		defer priv.Zero()
		// The table subscription message, EIP-191 personal_sign, as ethers produces it.
		sig := keys.PersonalSign(priv, "pokerchain-query:"+strconv.FormatInt(req.Timestamp, 10))
		return response{ID: req.ID, Result: map[string]string{"signature": "0x" + hex.EncodeToString(sig)}}

	case "broadcast":
		return broadcast(req)

	case "recentBlocks":
		return recentBlocks(req)

	default:
		return response{ID: req.ID, Error: fmt.Sprintf("unknown method %q", req.Method)}
	}
}

// blockWindows holds one rolling last-1000-blocks window per RPC endpoint, kept
// across calls (that is the point of the in-memory ring) so repeat queries are
// served locally after the first refresh.
var (
	windowsMu    sync.Mutex
	blockWindows = map[string]*lightnode.Window{}
)

func recentBlocks(req request) response {
	if req.RPC == "" {
		return response{ID: req.ID, Error: "rpc is required"}
	}
	windowsMu.Lock()
	win, ok := blockWindows[req.RPC]
	if !ok {
		win = lightnode.NewWindow(req.RPC, 1000, nil)
		blockWindows[req.RPC] = win
	}
	windowsMu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := win.Refresh(ctx); err != nil {
		// Serve what is cached even if a refresh failed (e.g. a transient node hiccup).
		if len(win.Blocks(0)) == 0 {
			return response{ID: req.ID, Error: err.Error()}
		}
	}
	return response{ID: req.ID, Result: map[string]any{
		"latest": win.Latest(),
		"blocks": win.Blocks(req.Count),
	}}
}

// chainClients keeps one gRPC client per node so repeat requests reuse a connection instead of dialling a new one.
var (
	clientsMu    sync.Mutex
	chainClients = map[string]*chain.Client{}
)

func chainClient(target, chainID string, useTLS bool) *chain.Client {
	key := fmt.Sprintf("%s|%s|%t", target, chainID, useTLS)
	clientsMu.Lock()
	defer clientsMu.Unlock()
	if c, ok := chainClients[key]; ok {
		return c
	}
	c := chain.New(target, chainID, useTLS)
	chainClients[key] = c
	return c
}

// broadcast signs one transaction and sends it to the node over gRPC, the way the SDK does for each kind:
//
//   - action: UNORDERED (no account sequence, the chain de-duplicates on signer + timeout), like performActionSync.
//     Returns once the node accepts it (CheckTx); the outcome arrives over the table's WebSocket.
//   - join, leave, topUp and send (a bank transfer): ORDERED (account sequence, 1,000,000 gas like the SDK), then waits until the chain has
//     committed the tx and reports a failed execution, like the SDK's signAndBroadcast with assertExecuted.
//     leave can carry the Sit & Go finishing order.
//
// The caller (Electron main) owns the code-32 sequence-retry policy; this reports a rejection with the node's log.
func broadcast(req request) response {
	if req.GRPC == "" || req.ChainID == "" {
		return response{ID: req.ID, Error: "grpc and chainId are required"}
	}
	priv, err := wallet.PrivateKey(req.Mnemonic)
	if err != nil {
		return response{ID: req.ID, Error: err.Error()}
	}
	defer priv.Zero()
	address, err := keys.Address(addressPrefix, priv.PubKey().SerializeCompressed())
	if err != nil {
		return response{ID: req.ID, Error: err.Error()}
	}

	var msg []byte
	switch req.Kind {
	case "action":
		msg = wire.PerformAction(address, req.GameID, req.Action, req.Amount, req.Data)
	case "join":
		msg = wire.JoinGame(address, req.GameID, req.Seat, req.BuyIn)
	case "leave":
		msg = leaveGameMsg(address, req.GameID, req.FinishingOrder)
	case "topUp":
		msg = wire.TopUp(address, req.GameID, req.Amount)
	case "send":
		if err := validateSend(address, req.From, req.To, req.Denom, req.Amount); err != nil {
			return response{ID: req.ID, Error: err.Error()}
		}
		msg = sendMsg(address, req.To, req.Denom, req.Amount)
	default:
		return response{ID: req.ID, Error: fmt.Sprintf("unknown action kind %q", req.Kind)}
	}

	// gRPC endpoints are grpc:// (plaintext) or grpcs:// (TLS); strip the scheme
	// for the Go client's host:port target and use it to pick TLS.
	target, useTLS := parseGRPC(req.GRPC)

	var hash string
	if req.Kind == "action" {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		c := chainClient(target, req.ChainID, useTLS)
		var number uint64
		if number, err = c.AccountNumber(ctx, address); err == nil {
			hash, err = c.Broadcast(ctx, priv, address, number, msg)
		}
	} else {
		// A money mover waits for the chain to commit, which takes longer than a CheckTx.
		ctx, cancel := context.WithTimeout(context.Background(), inclusionTimeout+20*time.Second)
		defer cancel()
		var node *txNode
		if node, err = newTxNode(target, req.ChainID, useTLS); err == nil {
			hash, err = node.sendAndConfirm(ctx, priv, address, msg)
		}
	}
	if err != nil {
		return response{ID: req.ID, Error: err.Error(), Result: map[string]any{
			"rejected":         chain.IsRejected(err),
			"sequenceMismatch": chain.IsSequenceMismatch(err),
		}}
	}
	return response{ID: req.ID, Result: map[string]string{"txHash": hash, "gameId": req.GameID}}
}

// parseGRPC turns grpc://host:port / grpcs://host:port (or a bare host:port)
// into a dial target and a TLS flag.
func parseGRPC(endpoint string) (target string, useTLS bool) {
	switch {
	case strings.HasPrefix(endpoint, "grpcs://"):
		return strings.TrimPrefix(endpoint, "grpcs://"), true
	case strings.HasPrefix(endpoint, "grpc://"):
		return strings.TrimPrefix(endpoint, "grpc://"), false
	case strings.HasPrefix(endpoint, "https://"):
		return strings.TrimPrefix(endpoint, "https://"), true
	case strings.HasPrefix(endpoint, "http://"):
		return strings.TrimPrefix(endpoint, "http://"), false
	default:
		return endpoint, false
	}
}

func writeResponse(out *bufio.Writer, resp response) {
	b, err := json.Marshal(resp)
	if err != nil {
		b, _ = json.Marshal(response{ID: resp.ID, Error: "encode failed"})
	}
	out.Write(b)
	out.WriteByte('\n')
	out.Flush()
}
