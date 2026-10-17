import { describe, expect, it } from "vitest";
import type { WithdrawalActivityItem } from "../hooks/useWithdrawalActivity";
import { pendingWithdrawalMicro } from "./pendingWithdrawals";

function item(nonce: string, amountMicro: string, status: WithdrawalActivityItem["status"]): WithdrawalActivityItem {
    return { nonce, amountMicro, status } as WithdrawalActivityItem;
}

describe("pendingWithdrawalMicro", () => {
    it("adds up the requests that are still pending", () => {
        expect(pendingWithdrawalMicro([item("0x1", "500000", "pending"), item("0x2", "1000000", "pending")], new Set())).toBe("1500000");
    });

    it("leaves out requests Ethereum has already paid", () => {
        expect(pendingWithdrawalMicro([item("0x1", "500000", "pending"), item("0x2", "1000000", "pending")], new Set(["0x1", "0x2"]))).toBe("0");
    });

    it("leaves out completed requests", () => {
        expect(pendingWithdrawalMicro([item("0x1", "500000", "completed"), item("0x2", "250000", "pending")], new Set())).toBe("250000");
    });
});
