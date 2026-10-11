import { describe, expect, it } from "vitest";
import { describeHandStrength } from "./handStrength";

describe("describeHandStrength", () => {
    it("describes a pocket pair before the flop", () => {
        const label = describeHandStrength(["AS", "AH"], []);
        expect(label).not.toBeNull();
        expect(label?.toLowerCase()).toContain("aces");
    });

    it("describes a made hand on the board", () => {
        const label = describeHandStrength(["AS", "KS"], ["QS", "JS", "TS"]);
        expect(label).not.toBeNull();
        expect(label?.toLowerCase()).toContain("flush");
    });

    it("is null without two hole cards or with hidden placeholders", () => {
        expect(describeHandStrength(undefined, [])).toBeNull();
        expect(describeHandStrength(["AS"], [])).toBeNull();
        expect(describeHandStrength(["X", "X"], [])).toBeNull();
    });
});
