import { describe, expect, it } from "vitest";
import { PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";
import type { PlayerDTO, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { resolveJoinSeat } from "./joinTable";

function makeState(overrides: Partial<TexasHoldemStateDTO> = {}): TexasHoldemStateDTO {
    return {
        gameOptions: {
            minBuyIn: "1000000",
            maxBuyIn: "10000000",
            minPlayers: 2,
            maxPlayers: 9,
            smallBlind: "10000",
            bigBlind: "20000",
            timeout: 30000,
        },
        players: [],
        communityCards: [],
        deck: "",
        pots: [],
        totalPot: "0",
        nextToAct: -1,
        previousActions: [],
        actionCount: 0,
        handNumber: 1,
        round: TexasHoldemRound.PREFLOP,
        winners: [],
        results: [],
        legalActions: [],
        availableSeats: [],
        signature: "",
        ...overrides,
    };
}

function makePlayer(overrides: Partial<PlayerDTO> = {}): PlayerDTO {
    return {
        address: "addr",
        seat: 1,
        stack: "1000000",
        isSmallBlind: false,
        isBigBlind: false,
        isDealer: false,
        holeCards: undefined,
        status: PlayerStatus.ACTIVE,
        lastAction: undefined,
        legalActions: [],
        sumOfBets: "0",
        timeout: 30000,
        signature: "",
        ...overrides,
    };
}

describe("resolveJoinSeat", () => {
    it("returns the requested seat when it is a positive number", () => {
        expect(resolveJoinSeat(5, makeState())).toBe(5);
    });

    it("throws when no seat is requested and game state has not loaded yet", () => {
        expect(() => resolveJoinSeat(undefined, undefined)).toThrow("game state not loaded yet");
    });

    it("returns the first empty seat when no seat is requested", () => {
        const state = makeState({
            gameOptions: { minBuyIn: "1000000", maxBuyIn: "10000000", minPlayers: 2, maxPlayers: 4, smallBlind: "10000", bigBlind: "20000", timeout: 30000 },
            players: [makePlayer({ seat: 1 }), makePlayer({ seat: 3 })],
        });
        expect(resolveJoinSeat(undefined, state)).toBe(2);
    });

    it("throws when every seat is occupied", () => {
        const state = makeState({
            gameOptions: { minBuyIn: "1000000", maxBuyIn: "10000000", minPlayers: 2, maxPlayers: 2, smallBlind: "10000", bigBlind: "20000", timeout: 30000 },
            players: [makePlayer({ seat: 1 }), makePlayer({ seat: 2 })],
        });
        expect(() => resolveJoinSeat(undefined, state)).toThrow("No available seats to join");
    });

    it("treats a requested seat of 0 as no request and resolves a real seat instead", () => {
        const state = makeState({
            gameOptions: { minBuyIn: "1000000", maxBuyIn: "10000000", minPlayers: 2, maxPlayers: 4, smallBlind: "10000", bigBlind: "20000", timeout: 30000 },
            players: [],
        });
        expect(resolveJoinSeat(0, state)).toBe(1);
    });
});
