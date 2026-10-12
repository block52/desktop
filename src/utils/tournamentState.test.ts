import { describe, expect, it } from "vitest";
import { PlayerStatus, TexasHoldemRound, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { isTablePlaying, isTournamentFinished, tournamentSurvivor } from "./tournamentState";

function table(round: TexasHoldemRound, statuses: PlayerStatus[], resultCount: number): TexasHoldemStateDTO {
    return {
        round,
        players: statuses.map((status, index) => ({ address: `b52p${index + 1}`, seat: index + 1, status })),
        results: Array.from({ length: resultCount }, (_, index) => ({ place: 4 - index, playerId: `b52p${index + 1}`, payout: "0" }))
    } as unknown as TexasHoldemStateDTO;
}

describe("isTournamentFinished", () => {
    it("is true at the END frame with results", () => {
        const state = table(TexasHoldemRound.END, [PlayerStatus.BUSTED, PlayerStatus.SHOWING, PlayerStatus.BUSTED, PlayerStatus.BUSTED], 4);
        expect(isTournamentFinished(state, true)).toBe(true);
    });

    it("is true when the table is parked at ANTE with one player standing (the chain's live case)", () => {
        const state = table(TexasHoldemRound.ANTE, [PlayerStatus.ACTIVE, PlayerStatus.BUSTED, PlayerStatus.BUSTED, PlayerStatus.BUSTED], 3);
        expect(isTournamentFinished(state, true)).toBe(true);
        expect(tournamentSurvivor(state)).toBe("b52p1");
    });

    it("is false mid-tournament", () => {
        const state = table(TexasHoldemRound.FLOP, [PlayerStatus.ACTIVE, PlayerStatus.ACTIVE, PlayerStatus.BUSTED, PlayerStatus.ACTIVE], 1);
        expect(isTournamentFinished(state, true)).toBe(false);
    });

    it("is false before any result is recorded, and for cash games", () => {
        expect(isTournamentFinished(table(TexasHoldemRound.END, [PlayerStatus.ACTIVE, PlayerStatus.ACTIVE], 0), true)).toBe(false);
        expect(isTournamentFinished(table(TexasHoldemRound.END, [PlayerStatus.ACTIVE, PlayerStatus.BUSTED], 1), false)).toBe(false);
    });
});

describe("tournamentSurvivor", () => {
    it("is null while several players remain", () => {
        expect(tournamentSurvivor(table(TexasHoldemRound.FLOP, [PlayerStatus.ACTIVE, PlayerStatus.ACTIVE], 0))).toBeNull();
    });
});

describe("isTablePlaying", () => {
    it("is true for a cash table mid-hand and false between hands", () => {
        expect(isTablePlaying(table(TexasHoldemRound.FLOP, [PlayerStatus.ACTIVE, PlayerStatus.ACTIVE], 0), false)).toBe(true);
        expect(isTablePlaying(table(TexasHoldemRound.ANTE, [PlayerStatus.ACTIVE, PlayerStatus.ACTIVE], 0), false)).toBe(false);
    });

    it("needs two live players", () => {
        expect(isTablePlaying(table(TexasHoldemRound.FLOP, [PlayerStatus.ACTIVE], 0), false)).toBe(false);
    });

    it("is true for a started Sit & Go and false once it finished", () => {
        expect(isTablePlaying(table(TexasHoldemRound.ANTE, [PlayerStatus.ACTIVE, PlayerStatus.ACTIVE, PlayerStatus.BUSTED], 1), true)).toBe(true);
        expect(isTablePlaying(table(TexasHoldemRound.END, [PlayerStatus.ACTIVE, PlayerStatus.BUSTED], 1), true)).toBe(false);
    });
});
