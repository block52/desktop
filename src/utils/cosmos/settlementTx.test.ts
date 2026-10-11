import { describe, expect, it } from "vitest";
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { finishingOrderFromState } from "./settlementTx";

const state = (results: Array<{ place: number; playerId: string; payout: string }>) => ({ results }) as TexasHoldemStateDTO;

describe("finishingOrderFromState", () => {
    it("orders players by finishing place, winner first", () => {
        const order = finishingOrderFromState(
            state([
                { place: 3, playerId: "c", payout: "0" },
                { place: 1, playerId: "a", payout: "9" },
                { place: 2, playerId: "b", payout: "3" }
            ])
        );
        expect(order).toEqual(["a", "b", "c"]);
    });

    it("is empty without results", () => {
        expect(finishingOrderFromState(state([]))).toEqual([]);
        expect(finishingOrderFromState(undefined)).toEqual([]);
    });
});
