import { describe, expect, it } from "vitest";
import { decomposeAmount } from "./chipBreakdown";

describe("decomposeAmount", () => {
    it("decomposes greedily, largest first", () => {
        expect(decomposeAmount(150).map(s => [s.value, s.count])).toEqual([[100, 1], [25, 2]]);
        expect(decomposeAmount(6).map(s => [s.value, s.count])).toEqual([[5, 1], [1, 1]]);
    });

    it("falls back to one white chip for zero or sub-dollar amounts", () => {
        expect(decomposeAmount(0)).toEqual([{ value: 1, file: "1chip", count: 1, visibleCount: 1 }]);
        expect(decomposeAmount(0.5)[0].file).toBe("1chip");
    });

    it("caps visible chips per pile and the number of piles", () => {
        expect(decomposeAmount(25 * 20)[0]).toMatchObject({ value: 500, count: 1 });
        expect(decomposeAmount(100 * 9)[0]).toMatchObject({ value: 500, count: 1 });
        expect(decomposeAmount(1 * 12)[0]).toMatchObject({ value: 5, count: 2 });
        expect(decomposeAmount(25 * 8 - 1 + 0).length).toBeLessThanOrEqual(4);
        expect(decomposeAmount(3).at(-1)?.visibleCount).toBeLessThanOrEqual(5);
    });
});
