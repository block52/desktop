import { describe, expect, it } from "vitest";
import { mintProgress, nextSyncHeight } from "./bridgeSync";

describe("nextSyncHeight", () => {
    it("is the next multiple of 50, strictly after the height", () => {
        expect(nextSyncHeight(0)).toBe(50);
        expect(nextSyncHeight(49)).toBe(50);
        expect(nextSyncHeight(50)).toBe(100);
        expect(nextSyncHeight(51)).toBe(100);
        expect(nextSyncHeight(1_236_230)).toBe(1_236_250);
    });
});

describe("mintProgress", () => {
    it("starts at 0% and counts down the blocks to the sync", () => {
        expect(mintProgress(1_236_230, 1_236_230)).toEqual({ target: 1_236_250, blocksLeft: 20, percent: 0, reached: false });
        expect(mintProgress(1_236_230, 1_236_240)).toEqual({ target: 1_236_250, blocksLeft: 10, percent: 50, reached: false });
    });
    it("reaches 100% at the sync height and stays there", () => {
        expect(mintProgress(1_236_230, 1_236_250)).toEqual({ target: 1_236_250, blocksLeft: 0, percent: 100, reached: true });
        expect(mintProgress(1_236_230, 1_236_300)).toMatchObject({ blocksLeft: 0, percent: 100, reached: true });
    });
    it("handles a deposit seen right before the boundary, and one right after it", () => {
        expect(mintProgress(49, 49)).toEqual({ target: 50, blocksLeft: 1, percent: 0, reached: false });
        expect(mintProgress(50, 50)).toEqual({ target: 100, blocksLeft: 50, percent: 0, reached: false });
    });
    it("ignores a height from before the start", () => {
        expect(mintProgress(120, 110).percent).toBe(0);
    });
});
