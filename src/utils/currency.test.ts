import { describe, expect, it } from "vitest";
import { convertAmountToBigInt } from "./currency";

describe("convertAmountToBigInt", () => {
    it("converts a decimal USDC amount to micro-units", () => {
        expect(convertAmountToBigInt("1.5", 6)).toBe(1500000n);
    });

    it("converts a whole-number amount", () => {
        expect(convertAmountToBigInt("10", 6)).toBe(10000000n);
    });

    it("returns 0n for an empty amount", () => {
        expect(convertAmountToBigInt("", 6)).toBe(0n);
    });

    it("returns 0n for a zero amount", () => {
        expect(convertAmountToBigInt("0", 6)).toBe(0n);
    });

    it("returns 0n when decimals is 0", () => {
        expect(convertAmountToBigInt("1.5", 0)).toBe(0n);
    });
});
