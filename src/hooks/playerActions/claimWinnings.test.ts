import { describe, expect, it } from "vitest";
import { resultsAlreadyOnChain } from "./claimWinnings";

describe("resultsAlreadyOnChain", () => {
    it("treats stale / already-finalized rejections as benign", () => {
        expect(resultsAlreadyOnChain(new Error("hand-end push is stale or the game is already finalized"))).toBe(true);
        expect(resultsAlreadyOnChain(new Error("Stale hand end"))).toBe(true);
    });

    it("treats every other failure as fatal", () => {
        expect(resultsAlreadyOnChain(new Error("insufficient funds"))).toBe(false);
        expect(resultsAlreadyOnChain("network down")).toBe(false);
    });
});
