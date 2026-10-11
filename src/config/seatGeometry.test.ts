import { describe, expect, it } from "vitest";
import { getSeatPercent, resolveTableSize, seatToUiPosition } from "./seatGeometry";

describe("resolveTableSize", () => {
    it("returns 2 for heads-up", () => {
        expect(resolveTableSize(2)).toBe(2);
    });

    it("returns 4 for a 3-max table (rounds up to the nearest supported size)", () => {
        expect(resolveTableSize(3)).toBe(4);
    });

    it("returns 4 exactly", () => {
        expect(resolveTableSize(4)).toBe(4);
    });

    it("returns 6 for a 5-max table", () => {
        expect(resolveTableSize(5)).toBe(6);
    });

    it("returns 9 for anything above 6", () => {
        expect(resolveTableSize(7)).toBe(9);
        expect(resolveTableSize(9)).toBe(9);
    });
});

describe("getSeatPercent", () => {
    it("places heads-up seats at top/bottom center", () => {
        expect(getSeatPercent(2, 0)).toEqual({ left: 50, top: 58 });
        expect(getSeatPercent(2, 1)).toEqual({ left: 50, top: 14 });
    });

    it("places 4-max seats in a diamond (bottom/left/top/right)", () => {
        expect(getSeatPercent(4, 0)).toEqual({ left: 50, top: 58 });
        expect(getSeatPercent(4, 1)).toEqual({ left: 8, top: 36 });
        expect(getSeatPercent(4, 2)).toEqual({ left: 50, top: 14 });
        expect(getSeatPercent(4, 3)).toEqual({ left: 92, top: 36 });
    });

    it("places 6-max seats symmetrically on both sides", () => {
        const left = getSeatPercent(6, 1);
        const right = getSeatPercent(6, 5);
        expect(left.top).toBe(right.top);
        expect(left.left).toBe(8);
        expect(right.left).toBe(92);
    });

    it("9-max: the bottom-row trio (indices 0, 1, 8) share an identical top value", () => {
        const hero = getSeatPercent(9, 0);
        const left = getSeatPercent(9, 1);
        const right = getSeatPercent(9, 8);
        expect(hero.top).toBe(left.top);
        expect(left.top).toBe(right.top);
    });

    it("9-max: the top-row pair (indices 4, 5) share an identical top value", () => {
        const left = getSeatPercent(9, 4);
        const right = getSeatPercent(9, 5);
        expect(left.top).toBe(right.top);
        expect(left.top).toBe(14);
    });

    it("9-max: the bottom-row trio is NOT at the compressed-range maximum (there's clearance below them)", () => {
        const hero = getSeatPercent(9, 0);
        expect(hero.top).toBeLessThan(58);
    });

    it("compresses the vertical range into [14, 58], never touching the raw [0, 100] extremes", () => {
        for (const size of [2, 4, 6, 9] as const) {
            for (let i = 0; i < size; i++) {
                const { top } = getSeatPercent(size, i);
                expect(top).toBeGreaterThanOrEqual(14);
                expect(top).toBeLessThanOrEqual(58);
            }
        }
    });
});

describe("seatToUiPosition", () => {
    it("places the hero at UI position 0 regardless of their real server seat", () => {
        expect(seatToUiPosition(1, 1, 9)).toBe(0);
        expect(seatToUiPosition(5, 5, 9)).toBe(0);
        expect(seatToUiPosition(9, 9, 9)).toBe(0);
    });

    it("places the next server seat at UI position 1, wrapping forward from the hero", () => {
        expect(seatToUiPosition(2, 1, 9)).toBe(1);
        expect(seatToUiPosition(6, 5, 9)).toBe(1);
    });

    it("wraps correctly when the other seat's number is lower than the hero's", () => {
        // Hero at server seat 5 of 9; seat 1 is 4 seats *before* hero going
        // forward, i.e. 5 seats after wrapping around — position 5.
        expect(seatToUiPosition(1, 5, 9)).toBe(5);
    });

    it("wraps correctly at the table-size boundary", () => {
        // Hero at seat 9 of 9; seat 1 is the very next seat going forward.
        expect(seatToUiPosition(1, 9, 9)).toBe(1);
    });

    it("works for smaller table sizes", () => {
        expect(seatToUiPosition(1, 1, 2)).toBe(0);
        expect(seatToUiPosition(2, 1, 2)).toBe(1);
    });
});
