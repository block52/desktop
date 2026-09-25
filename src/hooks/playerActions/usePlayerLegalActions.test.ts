import { describe, expect, it } from "vitest";
import { PlayerActionType, PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";
import type { LegalActionDTO, PlayerDTO, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { computeLegalActionsResult } from "./usePlayerLegalActions";

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

function makeLegalAction(overrides: Partial<LegalActionDTO> = {}): LegalActionDTO {
    return {
        action: PlayerActionType.CHECK,
        min: undefined,
        max: undefined,
        index: 1,
        ...overrides,
    };
}

describe("computeLegalActionsResult", () => {
    it("returns the default (empty) result while loading", () => {
        const result = computeLegalActionsResult(makeState(), "addr", true, null);
        expect(result.isLoading).toBe(true);
        expect(result.isPlayerInGame).toBe(false);
    });

    it("returns the default result on error", () => {
        const err = new Error("boom");
        const result = computeLegalActionsResult(makeState(), "addr", false, err);
        expect(result.error).toBe(err);
        expect(result.isPlayerInGame).toBe(false);
    });

    it("returns the default result when gameState is undefined", () => {
        const result = computeLegalActionsResult(undefined, "addr", false, null);
        expect(result.isPlayerInGame).toBe(false);
    });

    it("returns the default result when userAddress is null", () => {
        const result = computeLegalActionsResult(makeState({ players: [makePlayer()] }), null, false, null);
        expect(result.isPlayerInGame).toBe(false);
    });

    it("returns the default result when the player is not seated at this table", () => {
        const state = makeState({ players: [makePlayer({ address: "someone-else" })] });
        const result = computeLegalActionsResult(state, "addr", false, null);
        expect(result.isPlayerInGame).toBe(false);
    });

    it("matches the player case-insensitively by address", () => {
        const state = makeState({ players: [makePlayer({ address: "AdDr", seat: 3 })] });
        const result = computeLegalActionsResult(state, "addr", false, null);
        expect(result.isPlayerInGame).toBe(true);
        expect(result.playerSeat).toBe(3);
    });

    it("reports isPlayerTurn when nextToAct matches the player's seat", () => {
        const state = makeState({ nextToAct: 2, players: [makePlayer({ seat: 2 })] });
        const result = computeLegalActionsResult(state, "addr", false, null);
        expect(result.isPlayerTurn).toBe(true);
    });

    it("reports isPlayerTurn=false when nextToAct is a different seat", () => {
        const state = makeState({ nextToAct: 5, players: [makePlayer({ seat: 2 })] });
        const result = computeLegalActionsResult(state, "addr", false, null);
        expect(result.isPlayerTurn).toBe(false);
    });

    it("finds the fold action's index among legalActions", () => {
        const legalActions = [
            makeLegalAction({ action: PlayerActionType.CHECK, index: 4 }),
            makeLegalAction({ action: PlayerActionType.FOLD, index: 4 }),
        ];
        const state = makeState({ players: [makePlayer({ legalActions })] });
        const result = computeLegalActionsResult(state, "addr", false, null);
        expect(result.foldActionIndex).toBe(4);
    });

    it("returns null foldActionIndex when fold is not a legal action", () => {
        const legalActions = [makeLegalAction({ action: PlayerActionType.CHECK, index: 4 })];
        const state = makeState({ players: [makePlayer({ legalActions })] });
        const result = computeLegalActionsResult(state, "addr", false, null);
        expect(result.foldActionIndex).toBeNull();
    });

    it("derives actionTurnIndex from the first legal action", () => {
        const legalActions = [makeLegalAction({ index: 7 })];
        const state = makeState({ players: [makePlayer({ legalActions })] });
        const result = computeLegalActionsResult(state, "addr", false, null);
        expect(result.actionTurnIndex).toBe(7);
    });

    it("derives position flags from isSmallBlind/isBigBlind/isDealer OR the table's seat markers", () => {
        const state = makeState({ smallBlindPosition: 1, bigBlindPosition: 2, dealer: 3, players: [makePlayer({ seat: 2 })] });
        const result = computeLegalActionsResult(state, "addr", false, null);
        expect(result.isBigBlindPosition).toBe(true);
        expect(result.isSmallBlindPosition).toBe(false);
        expect(result.isDealerPosition).toBe(false);
    });

    it("normalizes an undefined sitInMethod/pendingSitOut to null", () => {
        const state = makeState({ players: [makePlayer({ sitInMethod: undefined, pendingSitOut: undefined })] });
        const result = computeLegalActionsResult(state, "addr", false, null);
        expect(result.sitInMethod).toBeNull();
        expect(result.pendingSitOut).toBeNull();
    });

    it("passes through a defined sitInMethod/pendingSitOut", () => {
        const state = makeState({ players: [makePlayer({ sitInMethod: "post-now", pendingSitOut: "next-hand" })] });
        const result = computeLegalActionsResult(state, "addr", false, null);
        expect(result.sitInMethod).toBe("post-now");
        expect(result.pendingSitOut).toBe("next-hand");
    });
});
