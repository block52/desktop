package main

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/decred/dcrd/dcrec/secp256k1/v4"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protowire"

	"github.com/block52/pokerchain-go-client/chain"
	"github.com/block52/pokerchain-go-client/keys"
	"github.com/block52/pokerchain-go-client/wire"
)

const (
	// orderedGas is the gas limit the SDK signs money-mover transactions with (its DEFAULT_GAS_LIMIT). The chain
	// takes no fee, so a generous limit costs nothing, and a Sit & Go claim pays several players in one tx.
	orderedGas = 1_000_000
	// inclusionTimeout bounds the wait for a broadcast tx to be committed.
	inclusionTimeout  = 60 * time.Second
	inclusionInterval = 500 * time.Millisecond
)

// txNode builds, signs and broadcasts ordered (account-sequence) transactions and waits for them to be committed,
// the way the SDK's signAndBroadcast does for joinGame, leaveGame and topUp. pokerchain-go-client's own ordered
// path fixes the gas limit at 250,000 and does not wait for inclusion, so this uses only its exported wire and keys
// packages.
type txNode struct {
	conn    *grpc.ClientConn
	chainID string
}

var (
	txNodesMu sync.Mutex
	txNodes   = map[string]*txNode{}
)

func newTxNode(target, chainID string, useTLS bool) (*txNode, error) {
	key := fmt.Sprintf("%s|%s|%t", target, chainID, useTLS)
	txNodesMu.Lock()
	defer txNodesMu.Unlock()
	if existing, ok := txNodes[key]; ok {
		return existing, nil
	}
	creds := insecure.NewCredentials()
	if useTLS {
		creds = credentials.NewTLS(nil)
	}
	conn, err := grpc.NewClient(target, grpc.WithTransportCredentials(creds), grpc.WithDefaultCallOptions(grpc.ForceCodecV2(rawCodec{})))
	if err != nil {
		return nil, err
	}
	created := &txNode{conn: conn, chainID: chainID}
	txNodes[key] = created
	return created, nil
}

func (n *txNode) accountInfo(ctx context.Context, address string) (number, sequence uint64, err error) {
	var res []byte
	if err := n.conn.Invoke(ctx, "/cosmos.auth.v1beta1.Query/AccountInfo", wire.AccountInfoRequest(address), &res); err != nil {
		if status.Code(err) == codes.NotFound {
			return 0, 0, chain.ErrNoAccount
		}
		return 0, 0, fmt.Errorf("account info: %w", err)
	}
	return wire.DecodeAccountNumberAndSequence(res)
}

// buildOrdered returns the signed TxRaw for one message at the given account sequence.
func buildOrdered(priv *secp256k1.PrivateKey, chainID string, accountNumber, sequence, gas uint64, msgAny []byte) []byte {
	body := wire.TxBodyOrdered(msgAny)
	authInfo := wire.AuthInfoSeq(priv.PubKey().SerializeCompressed(), gas, sequence)
	signature := keys.Sign64(priv, wire.SignDoc(body, authInfo, chainID, accountNumber))
	return wire.TxRaw(body, authInfo, signature)
}

// sendAndConfirm signs msgAny as an ordered tx, broadcasts it, and returns its hash once the chain has committed
// it successfully. A CheckTx refusal or a failed execution is a *chain.ErrRejected; it does not retry (the caller
// owns the sequence-mismatch retry).
func (n *txNode) sendAndConfirm(ctx context.Context, priv *secp256k1.PrivateKey, address string, msgAny []byte) (string, error) {
	number, sequence, err := n.accountInfo(ctx, address)
	if err != nil {
		return "", err
	}
	tx := buildOrdered(priv, n.chainID, number, sequence, orderedGas, msgAny)
	var res []byte
	if err := n.conn.Invoke(ctx, "/cosmos.tx.v1beta1.Service/BroadcastTx", wire.BroadcastTxRequest(tx), &res); err != nil {
		return "", fmt.Errorf("broadcast: %w", err)
	}
	out, err := wire.DecodeBroadcastTxResponse(res)
	if err != nil {
		return "", fmt.Errorf("broadcast: %w", err)
	}
	if out.Code != 0 {
		return out.TxHash, &chain.ErrRejected{Code: out.Code, Log: out.RawLog, TxHash: out.TxHash}
	}
	return out.TxHash, n.waitCommitted(ctx, out.TxHash)
}

// waitCommitted polls GetTx until the tx is in a block, and reports a failed execution.
func (n *txNode) waitCommitted(ctx context.Context, hash string) error {
	ctx, cancel := context.WithTimeout(ctx, inclusionTimeout)
	defer cancel()
	request := protowire.AppendString(protowire.AppendTag(nil, 1, protowire.BytesType), hash)
	for {
		var res []byte
		err := n.conn.Invoke(ctx, "/cosmos.tx.v1beta1.Service/GetTx", request, &res)
		if err == nil {
			result, decodeErr := decodeGetTx(res)
			if decodeErr != nil {
				return fmt.Errorf("get tx: %w", decodeErr)
			}
			if result.Code != 0 {
				return &chain.ErrRejected{Code: result.Code, Log: result.RawLog, TxHash: hash}
			}
			return nil
		}
		if !notYetCommitted(err) {
			return fmt.Errorf("get tx: %w", err)
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("transaction %s was accepted but not confirmed in time", hash)
		case <-time.After(inclusionInterval):
		}
	}
}

func notYetCommitted(err error) bool {
	if status.Code(err) == codes.NotFound {
		return true
	}
	return strings.Contains(strings.ToLower(err.Error()), "not found")
}

// decodeGetTx reads GetTxResponse{tx_response{code, raw_log}}: tx_response is field 2.
func decodeGetTx(b []byte) (wire.TxResult, error) {
	var out wire.TxResult
	for len(b) > 0 {
		num, typ, n := protowire.ConsumeTag(b)
		if n < 0 {
			return out, protowire.ParseError(n)
		}
		b = b[n:]
		if num == 2 && typ == protowire.BytesType {
			inner, m := protowire.ConsumeBytes(b)
			if m < 0 {
				return out, protowire.ParseError(m)
			}
			return decodeTxResponse(inner)
		}
		m := protowire.ConsumeFieldValue(num, typ, b)
		if m < 0 {
			return out, protowire.ParseError(m)
		}
		b = b[m:]
	}
	return out, errors.New("response has no tx_response")
}

func decodeTxResponse(b []byte) (wire.TxResult, error) {
	var out wire.TxResult
	for len(b) > 0 {
		num, typ, n := protowire.ConsumeTag(b)
		if n < 0 {
			return out, protowire.ParseError(n)
		}
		b = b[n:]
		switch {
		case num == 2 && typ == protowire.BytesType:
			v, m := protowire.ConsumeBytes(b)
			out.TxHash, b = string(v), b[m:]
		case num == 4 && typ == protowire.VarintType:
			v, m := protowire.ConsumeVarint(b)
			out.Code, b = uint32(v), b[m:]
		case num == 6 && typ == protowire.BytesType:
			v, m := protowire.ConsumeBytes(b)
			out.RawLog, b = string(v), b[m:]
		default:
			m := protowire.ConsumeFieldValue(num, typ, b)
			if m < 0 {
				return out, protowire.ParseError(m)
			}
			b = b[m:]
		}
	}
	return out, nil
}
