import { describe, expect, it } from "vitest";
import { GameFormat, GameVariant } from "@block52/poker-vm-sdk";
import { gameMatchesSearch } from "./gameSearch";
import type { GameWithFormat } from "./convertUtils";

function game(overrides: Partial<GameWithFormat>): GameWithFormat {
    return {
        gameId: "0x" + "ab".repeat(32),
        minBuyIn: "0",
        maxBuyIn: "0",
        minPlayers: 2,
        maxPlayers: 9,
        currentPlayers: 0,
        gameFormat: GameFormat.CASH,
        gameVariant: GameVariant.TEXAS_HOLDEM,
        smallBlind: "0",
        bigBlind: "0",
        ...overrides
    };
}

describe("gameMatchesSearch", () => {
    const q = (s: string) => s.toLowerCase();

    it("matches the full id and the visible short id (a substring)", () => {
        const g = game({ gameId: "0x522af6f3faa14816649c2e24a6ab3b951d56b5e85f7cb8803fe72f1a0127a80b" });
        expect(gameMatchesSearch(g, q("0x522af6"))).toBe(true); // short-id prefix shown in the row
        expect(gameMatchesSearch(g, q("0127a80b"))).toBe(true); // short-id suffix shown in the row
        expect(gameMatchesSearch(g, q("deadbeef"))).toBe(false);
    });

    it("matches the name when there is one", () => {
        expect(gameMatchesSearch(game({ name: "Tom's table" }), q("tom"))).toBe(true);
    });

    it("matches the creator address", () => {
        expect(gameMatchesSearch(game({ creator: "b521p78923d2qjzfywxajdy9hgz2rfrhg9gz0ujhwk" }), q("b521p789"))).toBe(true);
    });

    it("matches by variant", () => {
        const holdem = game({ gameVariant: GameVariant.TEXAS_HOLDEM });
        expect(gameMatchesSearch(holdem, q("holdem"))).toBe(true);
        expect(gameMatchesSearch(holdem, q("nlh"))).toBe(true);
        const omaha = game({ gameVariant: GameVariant.OMAHA });
        expect(gameMatchesSearch(omaha, q("omaha"))).toBe(true);
        expect(gameMatchesSearch(omaha, q("plo"))).toBe(true);
        expect(gameMatchesSearch(holdem, q("omaha"))).toBe(false);
    });

    it("matches by format", () => {
        expect(gameMatchesSearch(game({ gameFormat: GameFormat.CASH }), q("cash"))).toBe(true);
        const sng = game({ gameFormat: GameFormat.SIT_AND_GO });
        expect(gameMatchesSearch(sng, q("sng"))).toBe(true);
        expect(gameMatchesSearch(sng, q("sit"))).toBe(true);
        expect(gameMatchesSearch(game({ gameFormat: GameFormat.CASH }), q("sng"))).toBe(false);
    });

    it("empty query matches everything", () => {
        expect(gameMatchesSearch(game({}), "")).toBe(true);
    });

    it("a nameless table (the common case) is still findable by id/variant/format", () => {
        const nameless = game({ name: undefined, gameFormat: GameFormat.SIT_AND_GO, gameVariant: GameVariant.TEXAS_HOLDEM });
        expect(gameMatchesSearch(nameless, q("sng"))).toBe(true);
        expect(gameMatchesSearch(nameless, q("holdem"))).toBe(true);
    });
});
