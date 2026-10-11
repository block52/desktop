import { describe, expect, it } from "vitest";
import { normalizeTransfers } from "./useWalletTransfers";

const ME = "b52me";

const tx = (attributes: Record<string, string>, extra: Record<string, unknown> = {}) => ({
    txhash: "ABC",
    timestamp: "2026-10-11T03:55:53Z",
    code: 0,
    events: [
        {
            type: "transfer",
            attributes: Object.entries(attributes).map(([key, value]) => ({ key, value }))
        }
    ],
    ...extra
});

describe("normalizeTransfers", () => {
    it("marks a transfer to the address as incoming", () => {
        const [t] = normalizeTransfers(tx({ sender: "b52other", recipient: ME, amount: "500000usdc" }), ME);
        expect(t.direction).toBe("in");
        expect(t.counterparty).toBe("b52other");
        expect(t.amountMicro).toBe("500000");
        expect(t.timestamp).toBe(Date.parse("2026-10-11T03:55:53Z") / 1000);
    });

    it("marks a transfer from the address as outgoing", () => {
        const [t] = normalizeTransfers(tx({ sender: ME, recipient: "b52other", amount: "1000000usdc" }), ME);
        expect(t.direction).toBe("out");
        expect(t.counterparty).toBe("b52other");
    });

    it("ignores other denoms and unrelated transfers", () => {
        expect(normalizeTransfers(tx({ sender: "a", recipient: ME, amount: "5stake" }), ME)).toEqual([]);
        expect(normalizeTransfers(tx({ sender: "a", recipient: "b", amount: "5usdc" }), ME)).toEqual([]);
    });

    it("flags failed transactions", () => {
        const [t] = normalizeTransfers(tx({ sender: "a", recipient: ME, amount: "5usdc" }, { code: 5 }), ME);
        expect(t.success).toBe(false);
    });
});
