import { describe, expect, it } from "vitest";
import { formatShort, formatUnits, otherHoldings, parseUnits } from "./ethTokens";

describe("formatUnits", () => {
    it("shows whole and fractional amounts without trailing zeros", () => {
        expect(formatUnits(20_000_000n, 6)).toBe("20");
        expect(formatUnits(1_500_000n, 6)).toBe("1.5");
        expect(formatUnits(1n, 8)).toBe("0.00000001");
        expect(formatUnits(0n, 18)).toBe("0");
    });
});

describe("parseUnits", () => {
    it("reads typed amounts", () => {
        expect(parseUnits("20", 6)).toBe(20_000_000n);
        expect(parseUnits("1.5", 6)).toBe(1_500_000n);
        expect(parseUnits(" 0.000001 ", 6)).toBe(1n);
        expect(parseUnits("5.", 6)).toBe(5_000_000n);
    });
    it("refuses anything else", () => {
        for (const bad of ["", "abc", "-1", "1.2.3", "0.0000001", "1e6"]) expect(parseUnits(bad, 6)).toBeNull();
    });
});

describe("formatShort", () => {
    it("cuts to the given decimals without rounding up", () => {
        expect(formatShort(19_999_999n, 6, 2)).toBe("19.99");
        expect(formatShort(10n ** 18n, 18, 4)).toBe("1");
        expect(formatShort(123_456_789_000_000_000n, 18, 4)).toBe("0.1234");
    });
    it("never shows a non-zero amount as 0", () => {
        expect(formatShort(1n, 18, 4)).toBe("<0.0001");
        expect(formatShort(0n, 18, 4)).toBe("0");
    });
});

describe("otherHoldings", () => {
    it("lists only the non-zero assets besides USDC, briefly", () => {
        expect(otherHoldings({ eth: 20_000_000_000_000_000n, usdc: 5_000_000n, usdt: 10_000_000n, wbtc: 50_000n })).toEqual(["0.02 ETH", "10 USDT", "0.0005 wBTC"]);
    });
    it("is empty for a wallet that holds only USDC", () => {
        expect(otherHoldings({ eth: 0n, usdc: 5_000_000n, usdt: 0n, wbtc: 0n })).toEqual([]);
    });
});
