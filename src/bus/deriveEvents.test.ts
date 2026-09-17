import { describe, expect, it } from "vitest";
import {
    TexasHoldemRound,
    PlayerStatus,
    PlayerActionType,
    type TexasHoldemStateDTO,
    type PlayerDTO,
    type ActionDTO,
    type WinnerDTO,
} from "@block52/poker-vm-sdk";
import { deriveEvents, RegressedSnapshotError } from "./deriveEvents";

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

function makeAction(overrides: Partial<ActionDTO> = {}): ActionDTO {
    return {
        playerId: "addr",
        seat: 1,
        action: PlayerActionType.CALL,
        amount: "20000",
        round: TexasHoldemRound.PREFLOP,
        index: 0,
        timestamp: 0,
        ...overrides,
    };
}

function makeWinner(overrides: Partial<WinnerDTO> = {}): WinnerDTO {
    return {
        address: "addr",
        seat: 1,
        amount: "100",
        cards: undefined,
        name: undefined,
        description: undefined,
        ...overrides,
    };
}

describe("deriveEvents", () => {
    it("returns no events for the first frame after subscribe/reset", () => {
        const next = makeState();
        expect(deriveEvents(undefined, next)).toEqual([]);
    });

    it("derives handStarted when handNumber advances", () => {
        const prev = makeState({ handNumber: 1 });
        const next = makeState({ handNumber: 2 });
        const events = deriveEvents(prev, next);
        expect(events).toContainEqual({ type: "handStarted", handNumber: 2 });
    });

    it("derives playerActed for each new previousActions entry, in index order", () => {
        const prev = makeState({
            previousActions: [makeAction({ index: 0 })],
        });
        const next = makeState({
            previousActions: [
                makeAction({ index: 0 }),
                makeAction({ index: 2, action: PlayerActionType.RAISE, amount: "40000", seat: 2 }),
                makeAction({ index: 1, action: PlayerActionType.FOLD, seat: 3 }),
            ],
        });
        const events = deriveEvents(prev, next);
        const acted = events.filter(e => e.type === "playerActed");
        expect(acted).toHaveLength(2);
        expect((acted[0] as { action: ActionDTO }).action.index).toBe(1);
        expect((acted[1] as { action: ActionDTO }).action.index).toBe(2);
    });

    it("throws RegressedSnapshotError when same-hand action indices go backwards", () => {
        const prev = makeState({
            handNumber: 5,
            previousActions: [makeAction({ index: 10 })],
        });
        const next = makeState({
            handNumber: 5,
            previousActions: [makeAction({ index: 3 })],
        });
        expect(() => deriveEvents(prev, next)).toThrow(RegressedSnapshotError);
    });

    it("derives playerJoined and playerLeft by diffing seats", () => {
        const prev = makeState({ players: [makePlayer({ seat: 1, address: "addr1" })] });
        const next = makeState({ players: [makePlayer({ seat: 2, address: "addr2" })] });
        const events = deriveEvents(prev, next);
        expect(events).toContainEqual({ type: "playerLeft", seat: 1, address: "addr1" });
        expect(events).toContainEqual({ type: "playerJoined", seat: 2, address: "addr2" });
    });

    it("derives roundAdvanced only within the same hand, forward only", () => {
        const prev = makeState({ round: TexasHoldemRound.PREFLOP, communityCards: [] });
        const next = makeState({ round: TexasHoldemRound.FLOP, communityCards: ["2H", "3D", "4C"] });
        const events = deriveEvents(prev, next);
        expect(events).toContainEqual({
            type: "roundAdvanced",
            from: TexasHoldemRound.PREFLOP,
            to: TexasHoldemRound.FLOP,
            newCommunityCards: ["2H", "3D", "4C"],
        });
    });

    it("derives cardsRevealed when a masked hand becomes fully visible", () => {
        const prev = makeState({ players: [makePlayer({ seat: 1, address: "a", holeCards: ["X", "X"] })] });
        const next = makeState({ players: [makePlayer({ seat: 1, address: "a", holeCards: ["AS", "KD"] })] });
        const events = deriveEvents(prev, next);
        expect(events).toContainEqual({ type: "cardsRevealed", seat: 1, cards: ["AS", "KD"] });
    });

    it("derives stackChanged when a seat's stack string differs", () => {
        const prev = makeState({ players: [makePlayer({ seat: 1, address: "a", stack: "1000" })] });
        const next = makeState({ players: [makePlayer({ seat: 1, address: "a", stack: "800" })] });
        const events = deriveEvents(prev, next);
        expect(events).toContainEqual({ type: "stackChanged", seat: 1, from: "1000", to: "800" });
    });

    it("derives handEnded when winners transitions from empty to populated", () => {
        const prev = makeState({ winners: [] });
        const next = makeState({ winners: [makeWinner({ address: "a", amount: "100" })] });
        const events = deriveEvents(prev, next);
        expect(events).toContainEqual({ type: "handEnded", winners: next.winners });
    });
});
