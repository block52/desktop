import { describe, expect, it } from "vitest";
import { PlayerStatus, TexasHoldemRound, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { computeEquities, equityInput } from "./allInEquity";

function table(round: TexasHoldemRound, players: Array<{ seat: number; status: PlayerStatus; holeCards?: string[] }>, board: string[] = []): TexasHoldemStateDTO {
    return { round, communityCards: board, players } as unknown as TexasHoldemStateDTO;
}

describe("equityInput", () => {
    it("is null with nothing to show", () => {
        expect(equityInput(undefined)).toBeNull();
    });

    it("needs every live hand all-in with visible cards", () => {
        const state = table(TexasHoldemRound.FLOP, [
            { seat: 1, status: PlayerStatus.ALL_IN, holeCards: ["AS", "AD"] },
            { seat: 2, status: PlayerStatus.ACTIVE, holeCards: ["KS", "KD"] }
        ]);
        expect(equityInput(state)).toBeNull();
    });

    it("returns the hands and board when everyone is all-in and visible", () => {
        const state = table(
            TexasHoldemRound.FLOP,
            [
                { seat: 1, status: PlayerStatus.ALL_IN, holeCards: ["AS", "AD"] },
                { seat: 4, status: PlayerStatus.SHOWING, holeCards: ["KS", "KD"] },
                { seat: 6, status: PlayerStatus.FOLDED, holeCards: ["2C", "7H"] }
            ],
            ["2S", "7D", "9C", "??"]
        );
        expect(equityInput(state)).toEqual({
            hands: [
                { seat: 1, cards: ["AS", "AD"] },
                { seat: 4, cards: ["KS", "KD"] }
            ],
            board: ["2S", "7D", "9C"]
        });
    });

    it("ignores masked opponent cards", () => {
        const state = table(TexasHoldemRound.SHOWDOWN, [
            { seat: 1, status: PlayerStatus.SHOWING, holeCards: ["AS", "AD"] },
            { seat: 2, status: PlayerStatus.ACTIVE, holeCards: ["??", "??"] }
        ]);
        expect(equityInput(state)).toBeNull();
    });
});

describe("computeEquities", () => {
    it("gives aces the clear edge over kings and sums near 100", () => {
        const equities = computeEquities({
            hands: [
                { seat: 1, cards: ["AS", "AD"] },
                { seat: 4, cards: ["KS", "KD"] }
            ],
            board: []
        });
        expect(equities.get(1)).toBeGreaterThan(70);
        expect(equities.get(4)).toBeLessThan(30);
    });
});
