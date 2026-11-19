package main

import (
	"strconv"

	"google.golang.org/protobuf/encoding/protowire"

	"github.com/block52/pokerchain-go-client/wire"
)

const typeLeaveGame = "/pokerchain.poker.v1.MsgLeaveGame"

func appendString(b []byte, num protowire.Number, v string) []byte {
	b = protowire.AppendTag(b, num, protowire.BytesType)
	return protowire.AppendString(b, v)
}

// leaveGameMsg is MsgLeaveGame{creator, game_id, finishing_order} as a google.protobuf.Any. The Go client's
// wire.LeaveGame cannot set finishing_order, which a Sit & Go claim needs: the order (place 1 first) lets the
// chain work out payouts when its results are empty. With no order it is byte-identical to wire.LeaveGame.
func leaveGameMsg(creator, gameID string, finishingOrder []string) []byte {
	if len(finishingOrder) == 0 {
		return wire.LeaveGame(creator, gameID)
	}
	var m []byte
	m = appendString(m, 1, creator)
	m = appendString(m, 2, gameID)
	for _, address := range finishingOrder {
		m = appendString(m, 3, address)
	}
	var a []byte
	a = appendString(a, 1, typeLeaveGame)
	a = protowire.AppendTag(a, 2, protowire.BytesType)
	return protowire.AppendBytes(a, m)
}

const typeSend = "/cosmos.bank.v1beta1.MsgSend"

// sendMsg is cosmos.bank.v1beta1.MsgSend{from_address, to_address, amount: [Coin{denom, amount}]} as a
// google.protobuf.Any. The coin amount is a decimal string, as in the cosmos proto.
func sendMsg(from, to, denom string, amount uint64) []byte {
	var coin []byte
	coin = appendString(coin, 1, denom)
	coin = appendString(coin, 2, strconv.FormatUint(amount, 10))

	var m []byte
	m = appendString(m, 1, from)
	m = appendString(m, 2, to)
	m = protowire.AppendTag(m, 3, protowire.BytesType)
	m = protowire.AppendBytes(m, coin)

	var a []byte
	a = appendString(a, 1, typeSend)
	a = protowire.AppendTag(a, 2, protowire.BytesType)
	return protowire.AppendBytes(a, m)
}
