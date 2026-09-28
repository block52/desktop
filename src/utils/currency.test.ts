import { describe, expect, it } from "vitest";
import { convertAmountToBigInt, parseUsdcToMicro } from "./currency";

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

describe("parseUsdcToMicro", () => {
    it("parses a whole-dollar amount", () => {
        expect(parseUsdcToMicro("5")).toBe(5000000n);
    });

    it("parses a decimal amount exactly, with no float rounding error", () => {
        expect(parseUsdcToMicro("2.01")).toBe(2010000n);
    });

    it("parses an amount with fewer than 6 decimal places", () => {
        expect(parseUsdcToMicro("0.5")).toBe(500000n);
    });

    it("parses an amount with exactly 6 decimal places", () => {
        expect(parseUsdcToMicro("1.234567")).toBe(1234567n);
    });

    it("parses zero", () => {
        expect(parseUsdcToMicro("0")).toBe(0n);
    });

    it("tolerates a leading plus sign", () => {
        expect(parseUsdcToMicro("+3.5")).toBe(3500000n);
    });

    it("throws on an empty string", () => {
        expect(() => parseUsdcToMicro("")).toThrow("parseUsdcToMicro: amount is empty");
    });

    it("throws on a whitespace-only string", () => {
        expect(() => parseUsdcToMicro("   ")).toThrow("parseUsdcToMicro: amount is empty");
    });

    it("throws on a negative amount", () => {
        expect(() => parseUsdcToMicro("-1.5")).toThrow("amount cannot be negative");
    });

    it("throws on a non-numeric string", () => {
        expect(() => parseUsdcToMicro("abc")).toThrow("is not a valid decimal amount");
    });

    it("throws on a string with a currency symbol", () => {
        expect(() => parseUsdcToMicro("$5")).toThrow("is not a valid decimal amount");
    });

    it("throws on more than 6 decimal places", () => {
        expect(() => parseUsdcToMicro("1.2345678")).toThrow("has more than 6 decimal places");
    });

    it("throws on a bare decimal point", () => {
        expect(() => parseUsdcToMicro(".")).toThrow("is not a valid decimal amount");
    });
});
