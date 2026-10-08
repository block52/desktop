import { describe, it, expect } from "vitest";
import { computeAvgBlockTimeSeconds } from "./useAvgBlockTime";

describe("computeAvgBlockTimeSeconds", () => {
    it("averages the deltas between consecutive block timestamps", () => {
        // Blocks newest-first (as getLatestBlocks returns them), 12s apart each.
        const times = [
            "2026-01-01T00:01:00.000Z",
            "2026-01-01T00:00:48.000Z",
            "2026-01-01T00:00:36.000Z",
        ];
        expect(computeAvgBlockTimeSeconds(times)).toBe(12);
    });

    it("handles uneven deltas by averaging them", () => {
        const times = [
            "2026-01-01T00:01:00.000Z",
            "2026-01-01T00:00:50.000Z", // 10s delta
            "2026-01-01T00:00:30.000Z", // 20s delta
        ];
        expect(computeAvgBlockTimeSeconds(times)).toBe(15);
    });

    it("returns null when fewer than 2 timestamps are given", () => {
        expect(computeAvgBlockTimeSeconds([])).toBeNull();
        expect(computeAvgBlockTimeSeconds(["2026-01-01T00:00:00.000Z"])).toBeNull();
    });
});
