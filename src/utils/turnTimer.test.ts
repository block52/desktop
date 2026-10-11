import { describe, expect, it } from "vitest";
import type { ActionDTO } from "@block52/poker-vm-sdk";
import { latestActionTimestampMs, normalizeTimestamp, secondsRemaining, turnId } from "./turnTimer";

const action = (timestamp: number) => ({ timestamp }) as ActionDTO;

describe("turnTimer", () => {
    it("normalises seconds to milliseconds and leaves milliseconds alone", () => {
        expect(normalizeTimestamp(1_700_000_000)).toBe(1_700_000_000_000);
        expect(normalizeTimestamp(1_700_000_000_000)).toBe(1_700_000_000_000);
    });

    it("anchors on the newest action, or the fallback when there are none", () => {
        expect(latestActionTimestampMs([action(1_700_000_001_000), action(1_700_000_005_000)], 5)).toBe(1_700_000_005_000);
        expect(latestActionTimestampMs([], 42)).toBe(42);
    });

    it("counts whole seconds down and floors at zero", () => {
        expect(secondsRemaining(10_000, 0, 30)).toBe(20);
        expect(secondsRemaining(10_400, 0, 30)).toBe(20);
        expect(secondsRemaining(31_000, 0, 30)).toBe(0);
    });

    it("builds a turn id from the seat to act and the action count", () => {
        expect(turnId(3, 12)).toBe("3:12");
    });
});
