import { describe, expect, it } from "vitest";
import { sortGamesNewestFirst, type GameWithFormat } from "./convertUtils";

const game = (gameId: string, createdAt?: string): GameWithFormat => ({
    gameId,
    createdAt,
    minBuyIn: "0",
    maxBuyIn: "0",
    minPlayers: 2,
    maxPlayers: 2,
    currentPlayers: 0,
    gameFormat: "unknown",
    gameVariant: "unknown",
    smallBlind: "0",
    bigBlind: "0"
});

describe("sortGamesNewestFirst", () => {
    it("orders by createdAt descending with undated games last", () => {
        const sorted = sortGamesNewestFirst([
            game("old", "2026-09-01T00:00:00Z"),
            game("none"),
            game("new", "2026-10-11T04:20:53Z"),
            game("mid", "2026-10-09T16:09:17Z")
        ]);
        expect(sorted.map(g => g.gameId)).toEqual(["new", "mid", "old", "none"]);
    });

    it("does not mutate the input", () => {
        const input = [game("a", "2026-01-01T00:00:00Z"), game("b", "2026-02-01T00:00:00Z")];
        sortGamesNewestFirst(input);
        expect(input.map(g => g.gameId)).toEqual(["a", "b"]);
    });
});
