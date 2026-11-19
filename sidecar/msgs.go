package main

import (
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
