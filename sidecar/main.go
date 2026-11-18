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
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strconv"

	"github.com/block52/pokerchain-go-client/keys"
	"github.com/block52/pokerchain-go-client/wallet"
)

const addressPrefix = "b52"

type request struct {
	ID        int    `json:"id"`
	Method    string `json:"method"`
	Mnemonic  string `json:"mnemonic"`
	Bits      int    `json:"bits"`
	Timestamp int64  `json:"timestamp"`
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

	default:
		return response{ID: req.ID, Error: fmt.Sprintf("unknown method %q", req.Method)}
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
