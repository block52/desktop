import { describe, expect, it } from "vitest";
import { humaniseMsgType, normalizeRecentTx } from "./useRecentTxs";

describe("humaniseMsgType", () => {
    it("drops the package path and Msg prefix and spaces the words", () => {
        expect(humaniseMsgType("/pokerchain.poker.v1.MsgRecordEthBlockHeight")).toBe("Record Eth Block Height");
        expect(humaniseMsgType("/cosmos.bank.v1beta1.MsgSend")).toBe("Send");
    });
});

describe("normalizeRecentTx", () => {
    it("reads hash, height, type and status", () => {
        const tx = normalizeRecentTx({
            hash: "ABC",
            height: "10",
            tx_result: { code: 0, events: [{ type: "message", attributes: [{ key: "action", value: "/cosmos.bank.v1beta1.MsgSend" }] }] }
        });
        expect(tx).toEqual({ hash: "ABC", height: "10", type: "Send", success: true });
    });

    it("flags failures and tolerates missing events", () => {
        expect(normalizeRecentTx({ hash: "H", height: "1", tx_result: { code: 5 } })).toMatchObject({ type: "Transaction", success: false });
        expect(normalizeRecentTx({ height: "1" })).toBeNull();
    });
});
