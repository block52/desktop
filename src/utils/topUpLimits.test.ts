import { describe, expect, it } from "vitest";
import { maxTopUpMicro } from "./topUpLimits";

describe("maxTopUpMicro", () => {
    it("is limited by the buy-in headroom", () => {
        expect(maxTopUpMicro(500_000n, 2_000_000n, 10_000_000n)).toBe(1_500_000n);
    });

    it("is limited by the wallet when it is smaller", () => {
        expect(maxTopUpMicro(500_000n, 2_000_000n, 300_000n)).toBe(300_000n);
    });

    it("is zero when the stack is already at the max or the wallet is empty", () => {
        expect(maxTopUpMicro(2_000_000n, 2_000_000n, 5n)).toBe(0n);
        expect(maxTopUpMicro(100n, 2_000_000n, 0n)).toBe(0n);
    });
});
