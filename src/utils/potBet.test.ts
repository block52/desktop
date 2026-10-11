import { describe, expect, it } from "vitest";
import { potBetAmount } from "./potBet";

describe("potBetAmount", () => {
    it("opens for a fraction of the pot", () => {
        expect(potBetAmount(0.5, 100, 0, 10)).toBe(50);
        expect(potBetAmount(1, 100, 0, 10)).toBe(100);
    });

    it("never opens below the big blind", () => {
        expect(potBetAmount(0.25, 20, 0, 10)).toBe(10);
    });

    it("sizes a raise on the pot after calling", () => {
        // pot 100, call 20: after calling the pot is 120; half of it is 60, plus the 20 to call.
        expect(potBetAmount(0.5, 100, 20, 10)).toBe(80);
        expect(potBetAmount(1, 100, 20, 10)).toBe(140);
    });
});
