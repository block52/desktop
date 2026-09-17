import { describe, expect, it } from "vitest";
import {
    GameFormat,
    GameVariant,
    TexasHoldemRound,
    PlayerActionType,
    type TexasHoldemStateDTO,
    type ActionDTO,
} from "@block52/poker-vm-sdk";
import { GameMessageBus } from "./GameMessageBus";
import type { RawWsMessage } from "./ingest";

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

function stateMessage(snapshot: TexasHoldemStateDTO, gameId = "table1"): RawWsMessage {
    return {
        event: "state",
        gameId,
        data: { gameId, gameState: snapshot, format: GameFormat.CASH, variant: GameVariant.TEXAS_HOLDEM },
    };
}

describe("GameMessageBus", () => {
    it("ignores frames for a different table", () => {
        const bus = new GameMessageBus();
        const item = bus.ingest(stateMessage(makeState(), "other-table"), "table1");
        expect(item).toBeNull();
    });

    it("assigns a strictly monotonic seq across ingests", () => {
        const bus = new GameMessageBus();
        const first = bus.ingest(stateMessage(makeState({ handNumber: 1 })), "table1");
        const second = bus.ingest(stateMessage(makeState({ handNumber: 2 })), "table1");
        expect(first?.seq).toBe(1);
        expect(second?.seq).toBe(2);
    });

    it("derives no events on the first ingested frame", () => {
        const bus = new GameMessageBus();
        const item = bus.ingest(stateMessage(makeState({ handNumber: 1 })), "table1");
        expect(item?.events).toEqual([]);
    });

    it("derives events by diffing against the last ingested snapshot", () => {
        const bus = new GameMessageBus();
        bus.ingest(stateMessage(makeState({ handNumber: 1 })), "table1");
        const second = bus.ingest(stateMessage(makeState({ handNumber: 2 })), "table1");
        expect(second?.events).toContainEqual({ type: "handStarted", handNumber: 2 });
    });

    it("tracks the last snapshot via getLastSnapshot()", () => {
        const bus = new GameMessageBus();
        const snapshot = makeState({ handNumber: 3 });
        bus.ingest(stateMessage(snapshot), "table1");
        expect(bus.getLastSnapshot()).toBe(snapshot);
    });

    it("clears the last snapshot on reset()", () => {
        const bus = new GameMessageBus();
        bus.ingest(stateMessage(makeState({ handNumber: 1 })), "table1");
        bus.reset();
        expect(bus.getLastSnapshot()).toBeUndefined();
        const item = bus.ingest(stateMessage(makeState({ handNumber: 5 })), "table1");
        expect(item?.events).toEqual([]); // no prior snapshot after reset -> no derived events
    });

    it("does not throw when event derivation fails; commits the frame with no events", () => {
        const bus = new GameMessageBus();
        const action = (index: number): ActionDTO => ({
            playerId: "addr",
            seat: 1,
            action: PlayerActionType.CALL,
            amount: "1",
            round: TexasHoldemRound.PREFLOP,
            index,
            timestamp: 0,
        });
        // Same hand number, action indices regress -> deriveEvents throws internally.
        bus.ingest(
            {
                event: "state",
                gameId: "table1",
                data: { gameId: "table1", gameState: makeState({ handNumber: 5, previousActions: [action(10)] }) },
            },
            "table1"
        );
        const item = bus.ingest(
            {
                event: "state",
                gameId: "table1",
                data: { gameId: "table1", gameState: makeState({ handNumber: 5, previousActions: [action(3)] }) },
            },
            "table1"
        );
        expect(item).not.toBeNull();
        expect(item?.events).toEqual([]);
    });
});
