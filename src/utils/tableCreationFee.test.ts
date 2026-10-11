import { describe, expect, it } from "vitest";
import { computeTableCreationFeeMicro } from "./tableCreationFee";

describe("computeTableCreationFeeMicro", () => {
    it("charges 10 big blinds for cash tables", () => {
        expect(computeTableCreationFeeMicro(false, 20_000n, 0n, null)).toBe(200_000n);
    });

    it("prices Sit & Go by the chip value of 10 big blinds", () => {
        // BB 50 chips, $1 entry, 1,500 stack → floor(10 × 50 × 1,000,000 ÷ 1,500)
        expect(computeTableCreationFeeMicro(true, 50n, 1_000_000n, 1500n)).toBe(333_333n);
    });

    it("returns null when it cannot be priced", () => {
        expect(computeTableCreationFeeMicro(false, 0n, 0n, null)).toBeNull();
        expect(computeTableCreationFeeMicro(true, 50n, 1_000_000n, null)).toBeNull();
    });
});
