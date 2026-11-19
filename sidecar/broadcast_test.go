package main

import (
	"bytes"
	"context"
	"net"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/decred/dcrd/dcrec/secp256k1/v4"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protowire"

	"github.com/block52/pokerchain-go-client/chain"
	"github.com/block52/pokerchain-go-client/keys"
	"github.com/block52/pokerchain-go-client/wire"
)

// fakeNode serves AccountInfo, BroadcastTx and GetTx like a node, and records what it was sent.
type fakeNode struct {
	mu            sync.Mutex
	sequence      uint64
	broadcastCode uint32
	broadcastLog  string
	execCode      uint32
	execLog       string
	notFoundFor   int // GetTx answers NotFound this many times before the tx is "committed"
	txs           [][]byte
	getTxCalls    int
}

func varint(num protowire.Number, v uint64) []byte {
	return protowire.AppendVarint(protowire.AppendTag(nil, num, protowire.VarintType), v)
}

func bytesOf(num protowire.Number, v []byte) []byte {
	return protowire.AppendBytes(protowire.AppendTag(nil, num, protowire.BytesType), v)
}

func (f *fakeNode) handler(_ any, stream grpc.ServerStream) error {
	method, _ := grpc.MethodFromServerStream(stream)
	var in []byte
	if err := stream.RecvMsg(&in); err != nil {
		return err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	switch method {
	case "/cosmos.auth.v1beta1.Query/AccountInfo":
		base := append(varint(3, 42), varint(4, f.sequence)...)
		return stream.SendMsg(bytesOf(1, base))
	case "/cosmos.tx.v1beta1.Service/BroadcastTx":
		f.txs = append(f.txs, fieldBytes(in, 1))
		resp := bytesOf(2, []byte("HASH1"))
		if f.broadcastCode != 0 {
			resp = append(resp, varint(4, uint64(f.broadcastCode))...)
			resp = append(resp, bytesOf(6, []byte(f.broadcastLog))...)
		}
		return stream.SendMsg(bytesOf(1, resp))
	case "/cosmos.tx.v1beta1.Service/GetTx":
		f.getTxCalls++
		if f.getTxCalls <= f.notFoundFor {
			return status.Error(codes.NotFound, "tx not found")
		}
		resp := bytesOf(2, []byte("HASH1"))
		if f.execCode != 0 {
			resp = append(resp, varint(4, uint64(f.execCode))...)
			resp = append(resp, bytesOf(6, []byte(f.execLog))...)
		}
		return stream.SendMsg(bytesOf(2, resp))
	}
	return status.Error(codes.Unimplemented, method)
}

func fieldBytes(b []byte, want protowire.Number) []byte {
	for len(b) > 0 {
		num, typ, n := protowire.ConsumeTag(b)
		b = b[n:]
		if typ == protowire.BytesType {
			v, m := protowire.ConsumeBytes(b)
			if num == want {
				return v
			}
			b = b[m:]
		} else {
			b = b[protowire.ConsumeFieldValue(num, typ, b):]
		}
	}
	return nil
}

func fieldVarint(b []byte, want protowire.Number) uint64 {
	for len(b) > 0 {
		num, typ, n := protowire.ConsumeTag(b)
		b = b[n:]
		if typ == protowire.VarintType {
			v, m := protowire.ConsumeVarint(b)
			if num == want {
				return v
			}
			b = b[m:]
		} else {
			b = b[protowire.ConsumeFieldValue(num, typ, b):]
		}
	}
	return 0
}

func startNode(t *testing.T, f *fakeNode) string {
	t.Helper()
	srv := grpc.NewServer(grpc.UnknownServiceHandler(f.handler), grpc.ForceServerCodecV2(rawCodec{}))
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	go srv.Serve(lis)
	t.Cleanup(srv.Stop)
	return "grpc://" + lis.Addr().String()
}

const testMnemonic = "test test test test test test test test test test test junk"

// send runs one broadcast request against a fake node, the way the Electron side does.
func send(t *testing.T, node *fakeNode, kind string, fill func(*request)) response {
	t.Helper()
	req := request{Method: "broadcast", Mnemonic: testMnemonic, GRPC: startNode(t, node), ChainID: "pokerchain", Kind: kind, GameID: "0xgame"}
	if fill != nil {
		fill(&req)
	}
	return handle(req)
}

func txParts(t *testing.T, tx []byte) (body, authInfo []byte) {
	t.Helper()
	return fieldBytes(tx, 1), fieldBytes(tx, 2)
}

func TestBuildOrderedMatchesTheClientsExceptForGas(t *testing.T) {
	priv := secp256k1.PrivKeyFromBytes([]byte("0123456789abcdef0123456789abcdef"))
	addr, _ := keys.Address("b52", priv.PubKey().SerializeCompressed())
	msg := wire.JoinGame(addr, "0xgame", 3, 5_000_000)
	if !bytes.Equal(buildOrdered(priv, "pokerchain", 42, 7, 250_000, msg), chain.BuildOrdered(priv, "pokerchain", 42, 7, msg)) {
		t.Fatal("the ordered tx differs from pokerchain-go-client's at the same gas limit")
	}
}

func TestJoinIsOrderedWaitsForInclusionAndUsesTheSDKGasLimit(t *testing.T) {
	node := &fakeNode{sequence: 9, notFoundFor: 2}
	res := send(t, node, "join", func(r *request) { r.Seat, r.BuyIn = 4, 5_000_000 })
	if res.Error != "" {
		t.Fatalf("join: %s", res.Error)
	}
	if got := res.Result.(map[string]string)["txHash"]; got != "HASH1" {
		t.Fatalf("tx hash %q", got)
	}
	if node.getTxCalls != 3 {
		t.Fatalf("expected to poll until committed (3 GetTx calls), got %d", node.getTxCalls)
	}
	body, authInfo := txParts(t, node.txs[0])
	if fieldVarint(body, 4) != 0 {
		t.Fatal("a join must be an ordered tx, not unordered")
	}
	if seq := fieldVarint(fieldBytes(authInfo, 1), 3); seq != 9 {
		t.Fatalf("signed with sequence %d, want 9", seq)
	}
	if gas := fieldVarint(fieldBytes(authInfo, 2), 2); gas != 1_000_000 {
		t.Fatalf("gas limit %d, want 1000000", gas)
	}
	if msg := fieldBytes(body, 1); !strings.Contains(string(msg), "MsgJoinGame") || !strings.Contains(string(msg), "0xgame") {
		t.Fatalf("not a join message: %q", msg)
	}
}

func TestAFailedExecutionIsReportedEvenThoughCheckTxPassed(t *testing.T) {
	node := &fakeNode{execCode: 5, execLog: "insufficient funds"}
	res := send(t, node, "topUp", func(r *request) { r.Amount = 100 })
	if !strings.Contains(res.Error, "insufficient funds") {
		t.Fatalf("expected the execution failure, got %+v", res)
	}
	if info, _ := res.Result.(map[string]any); info == nil || info["rejected"] != true {
		t.Fatalf("expected rejected=true, got %+v", res.Result)
	}
}

func TestSequenceMismatchKeepsTheNodesTextSoTheAppRetries(t *testing.T) {
	node := &fakeNode{broadcastCode: 32, broadcastLog: "account sequence mismatch, expected 10, got 9"}
	res := send(t, node, "leave", nil)
	if !strings.Contains(res.Error, "account sequence mismatch") {
		t.Fatalf("the app's retry matches on this text, got %q", res.Error)
	}
	if info, _ := res.Result.(map[string]any); info == nil || info["sequenceMismatch"] != true {
		t.Fatalf("expected sequenceMismatch=true, got %+v", res.Result)
	}
}

func TestLeaveCarriesTheFinishingOrder(t *testing.T) {
	node := &fakeNode{}
	order := []string{"b52first", "b52second", "b52third"}
	if res := send(t, node, "leave", func(r *request) { r.FinishingOrder = order }); res.Error != "" {
		t.Fatalf("leave: %s", res.Error)
	}
	body, _ := txParts(t, node.txs[0])
	value := fieldBytes(fieldBytes(body, 1), 2) // the message inside the Any
	var got []string
	for b := value; len(b) > 0; {
		num, typ, n := protowire.ConsumeTag(b)
		b = b[n:]
		v, m := protowire.ConsumeBytes(b)
		b = b[m:]
		if num == 3 && typ == protowire.BytesType {
			got = append(got, string(v))
		}
	}
	if strings.Join(got, ",") != strings.Join(order, ",") {
		t.Fatalf("finishing order %v, want %v", got, order)
	}
}

func TestLeaveWithoutAnOrderIsTheClientsOwnMessage(t *testing.T) {
	if !bytes.Equal(leaveGameMsg("b52me", "0xgame", nil), wire.LeaveGame("b52me", "0xgame")) {
		t.Fatal("an empty finishing order must encode exactly like wire.LeaveGame")
	}
}

func TestAGameActionIsUnorderedAndDoesNotWaitForInclusion(t *testing.T) {
	node := &fakeNode{sequence: 9}
	res := send(t, node, "action", func(r *request) { r.Action, r.Amount = "call", 100 })
	if res.Error != "" {
		t.Fatalf("action: %s", res.Error)
	}
	body, authInfo := txParts(t, node.txs[0])
	if fieldVarint(body, 4) != 1 {
		t.Fatal("a game action must be unordered, like the SDK's performActionSync")
	}
	if seq := fieldVarint(fieldBytes(authInfo, 1), 3); seq != 0 {
		t.Fatalf("an unordered tx signs with sequence 0, got %d", seq)
	}
	if node.getTxCalls != 0 {
		t.Fatal("an action returns at CheckTx and must not wait for inclusion")
	}
}

func TestWaitGivesUpWhenTheTxNeverCommits(t *testing.T) {
	node := &fakeNode{notFoundFor: 1 << 30}
	n, err := newTxNode(strings.TrimPrefix(startNode(t, node), "grpc://"), "pokerchain", false)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 1500*time.Millisecond)
	defer cancel()
	if err := n.waitCommitted(ctx, "HASH1"); err == nil {
		t.Fatal("expected a timeout")
	}
}

func TestBadRequestsAreRefused(t *testing.T) {
	if res := handle(request{Method: "broadcast", Mnemonic: testMnemonic, Kind: "join"}); res.Error == "" {
		t.Fatal("a missing node must be refused")
	}
	if res := send(t, &fakeNode{}, "nonsense", nil); !strings.Contains(res.Error, "unknown action kind") {
		t.Fatalf("got %q", res.Error)
	}
}
