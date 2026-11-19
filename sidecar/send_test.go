package main

import (
	"strings"
	"testing"

	"github.com/btcsuite/btcd/btcutil/bech32"

	"github.com/block52/pokerchain-go-client/wallet"
)

// Throwaway test phrases, never used for anything real.
const otherMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

func addressOf(t *testing.T, mnemonic string) string {
	t.Helper()
	address, err := wallet.Address(mnemonic, addressPrefix)
	if err != nil {
		t.Fatal(err)
	}
	return address
}

// decodeSend reads a MsgSend Any back into its parts.
func decodeSend(t *testing.T, msgAny []byte) (typeURL, from, to, denom, amount string) {
	t.Helper()
	typeURL = string(fieldBytes(msgAny, 1))
	value := fieldBytes(msgAny, 2)
	from, to = string(fieldBytes(value, 1)), string(fieldBytes(value, 2))
	coin := fieldBytes(value, 3)
	return typeURL, from, to, string(fieldBytes(coin, 1)), string(fieldBytes(coin, 2))
}

func TestSendMsgEncodesAMsgSend(t *testing.T) {
	typeURL, from, to, denom, amount := decodeSend(t, sendMsg("b52from", "b52to", "usdc", 2_500_000))
	if typeURL != "/cosmos.bank.v1beta1.MsgSend" || from != "b52from" || to != "b52to" || denom != "usdc" || amount != "2500000" {
		t.Fatalf("got %s %s %s %s %s", typeURL, from, to, denom, amount)
	}
}

func TestValidateSend(t *testing.T) {
	own, to := addressOf(t, testMnemonic), addressOf(t, otherMnemonic)

	if err := validateSend(own, "", to, "usdc", 1); err != nil {
		t.Fatalf("a valid send was refused: %v", err)
	}
	if err := validateSend(own, own, to, "usdc", 1); err != nil {
		t.Fatalf("naming the wallet's own address as sender must be fine: %v", err)
	}

	// A valid checksum but another chain's prefix.
	_, data, _ := bech32.Decode(to)
	cosmos, _ := bech32.Encode("cosmos", data)
	// A b52 address with one character changed breaks the checksum.
	broken := to[:len(to)-1] + map[bool]string{true: "q", false: "p"}[to[len(to)-1] != 'q']

	cases := map[string]struct {
		from, to, denom string
		amount          uint64
		want            string
	}{
		"another sender":   {from: to, to: to, denom: "usdc", amount: 1, want: "sender must be this wallet"},
		"zero amount":      {to: to, denom: "usdc", amount: 0, want: "greater than zero"},
		"empty denom":      {to: to, denom: "", amount: 1, want: "not a valid denom"},
		"odd denom":        {to: to, denom: "us dc", amount: 1, want: "not a valid denom"},
		"empty recipient":  {to: "", denom: "usdc", amount: 1, want: "not a valid address"},
		"not an address":   {to: "hello", denom: "usdc", amount: 1, want: "not a valid address"},
		"bad checksum":     {to: broken, denom: "usdc", amount: 1, want: "not a valid address"},
		"another chain":    {to: cosmos, denom: "usdc", amount: 1, want: "must be a b52 address"},
		"ethereum address": {to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", denom: "usdc", amount: 1, want: "not a valid address"},
	}
	for name, c := range cases {
		if err := validateSend(own, c.from, c.to, c.denom, c.amount); err == nil || !strings.Contains(err.Error(), c.want) {
			t.Errorf("%s: got %v, want an error containing %q", name, err, c.want)
		}
	}
}

func TestSendIsOrderedWaitsForInclusionAndSignsAsTheWallet(t *testing.T) {
	own, to := addressOf(t, testMnemonic), addressOf(t, otherMnemonic)
	node := &fakeNode{sequence: 3, notFoundFor: 1}
	res := send(t, node, "send", func(r *request) { r.To, r.Denom, r.Amount = to, "usdc", 2_500_000 })
	if res.Error != "" {
		t.Fatalf("send: %s", res.Error)
	}
	if node.getTxCalls != 2 {
		t.Fatalf("expected to poll until committed (2 GetTx calls), got %d", node.getTxCalls)
	}
	body, authInfo := txParts(t, node.txs[0])
	if fieldVarint(body, 4) != 0 {
		t.Fatal("a bank send must be an ordered tx")
	}
	if seq := fieldVarint(fieldBytes(authInfo, 1), 3); seq != 3 {
		t.Fatalf("signed with sequence %d, want 3", seq)
	}
	if gas := fieldVarint(fieldBytes(authInfo, 2), 2); gas != 1_000_000 {
		t.Fatalf("gas limit %d, want 1000000", gas)
	}
	_, from, gotTo, denom, amount := decodeSend(t, fieldBytes(body, 1))
	if from != own || gotTo != to || denom != "usdc" || amount != "2500000" {
		t.Fatalf("message was %s -> %s %s %s", from, gotTo, amount, denom)
	}
	// The sender is always the wallet's own address, whatever the request says.
	if _, _, _, _, _ = decodeSend(t, fieldBytes(body, 1)); from != own {
		t.Fatal("sender is not the wallet")
	}
}

func TestSendRefusesBeforeAnythingReachesTheNode(t *testing.T) {
	own, to := addressOf(t, testMnemonic), addressOf(t, otherMnemonic)
	for name, fill := range map[string]func(*request){
		"another sender": func(r *request) { r.From, r.To, r.Denom, r.Amount = to, to, "usdc", 1 },
		"zero amount":    func(r *request) { r.From, r.To, r.Denom, r.Amount = own, to, "usdc", 0 },
		"bad recipient":  func(r *request) { r.To, r.Denom, r.Amount = "b52notanaddress", "usdc", 1 },
	} {
		node := &fakeNode{}
		if res := send(t, node, "send", fill); res.Error == "" {
			t.Errorf("%s: expected a refusal", name)
		}
		if len(node.txs) != 0 {
			t.Errorf("%s: a refused send must not be broadcast", name)
		}
	}
}

func TestSendReportsAFailedExecution(t *testing.T) {
	to := addressOf(t, otherMnemonic)
	node := &fakeNode{execCode: 5, execLog: "insufficient funds"}
	res := send(t, node, "send", func(r *request) { r.To, r.Denom, r.Amount = to, "usdc", 1 })
	if !strings.Contains(res.Error, "insufficient funds") {
		t.Fatalf("expected the execution failure, got %+v", res)
	}
}
