import { describe, expect, it } from "vitest";
import { blindLevelSecondsRemaining, formatCountdown } from "./blindLevel";

describe("blindLevelSecondsRemaining", () => {
    it("counts down from the level length", () => {
        expect(blindLevelSecondsRemaining(1_000_000, 3, 1_000_000 + 10_000)).toBe(170);
    });

    it("goes negative while a hand runs past the level end", () => {
        expect(blindLevelSecondsRemaining(1_000_000, 3, 1_000_000 + 190_000)).toBe(-10);
    });

    it("is null without a usable start time or duration", () => {
        expect(blindLevelSecondsRemaining(undefined, 3, 5)).toBeNull();
        expect(blindLevelSecondsRemaining(0, 3, 5)).toBeNull();
        expect(blindLevelSecondsRemaining(100, 0, 5)).toBeNull();
    });
});

describe("formatCountdown", () => {
    it("formats minutes and padded seconds", () => {
        expect(formatCountdown(222)).toBe("3:42");
        expect(formatCountdown(5)).toBe("0:05");
    });

    it("marks overtime with a minus sign", () => {
        expect(formatCountdown(-10)).toBe("-0:10");
    });
});
