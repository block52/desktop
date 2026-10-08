import { describe, it, expect } from "vitest";
import { GameFormat, GameVariant } from "@block52/poker-vm-sdk";
import { selectFeaturedGame } from "./selectFeaturedGame";
import type { GameWithFormat } from "./convertUtils";

function makeGame(overrides: Partial<GameWithFormat>): GameWithFormat {
    return {
        gameId: "default",
        minBuyIn: "1000000",
        maxBuyIn: "2000000",
        minPlayers: 2,
        maxPlayers: 6,
        currentPlayers: 0,
        gameFormat: GameFormat.SIT_AND_GO,
        gameVariant: GameVariant.TEXAS_HOLDEM,
        smallBlind: "10000",
        bigBlind: "20000",
        ...overrides,
    };
}

describe("selectFeaturedGame", () => {
    it("returns null when there are no Sit & Go games", () => {
        const games = [makeGame({ gameId: "a", gameFormat: GameFormat.CASH })];
        expect(selectFeaturedGame(games)).toBeNull();
    });

    it("returns null for an empty list", () => {
        expect(selectFeaturedGame([])).toBeNull();
    });

    it("picks the Sit & Go with the soonest sngStartTime", () => {
        const soon = makeGame({ gameId: "soon", sngStartTime: 1000 });
        const later = makeGame({ gameId: "later", sngStartTime: 5000 });
        const cash = makeGame({ gameId: "cash", gameFormat: GameFormat.CASH, sngStartTime: 1 });
        expect(selectFeaturedGame([later, soon, cash])?.gameId).toBe("soon");
    });

    it("falls back to the fullest Sit & Go when none have sngStartTime", () => {
        const empty = makeGame({ gameId: "empty", currentPlayers: 0, maxPlayers: 6 });
        const full = makeGame({ gameId: "full", currentPlayers: 5, maxPlayers: 6 });
        expect(selectFeaturedGame([empty, full])?.gameId).toBe("full");
    });

    it("ignores tournament-format games (only sit-and-go counts as featured)", () => {
        const tournament = makeGame({ gameId: "t", gameFormat: GameFormat.TOURNAMENT, sngStartTime: 1 });
        expect(selectFeaturedGame([tournament])).toBeNull();
    });
});
