import { describe, expect, it } from "vitest";
import { formatUnits, parseUnits } from "./ethTokens";

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
