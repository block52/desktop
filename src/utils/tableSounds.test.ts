import { describe, expect, it } from "vitest";
import { soundForAction } from "./tableSounds";

describe("soundForAction", () => {
    it("maps betting actions to their sound", () => {
        expect(soundForAction("call")).toBe("call");
        expect(soundForAction("check")).toBe("check");
        expect(soundForAction("fold")).toBe("fold");
        expect(soundForAction("all-in")).toBe("all-in");
    });

    it("shares one sound between bet and raise", () => {
        expect(soundForAction("bet")).toBe("bet-raise");
        expect(soundForAction("raise")).toBe("bet-raise");
    });

    it("is silent for actions without a sound", () => {
        expect(soundForAction("muck")).toBeNull();
        expect(soundForAction("post-small-blind")).toBeNull();
        expect(soundForAction("deal")).toBeNull();
    });
});
