import { describe, expect, it } from "vitest";
import { GameFormat, GameVariant, TexasHoldemRound, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { classifyMessage, type RawWsMessage } from "./ingest";

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

const TABLE_ID = "table1";

describe("classifyMessage", () => {
    it("classifies a state-bearing message for the current table as kind:state with no validation error", () => {
        const snapshot = makeState({ handNumber: 3 });
        const message: RawWsMessage = {
            event: "state",
            gameId: TABLE_ID,
            data: {
                gameId: TABLE_ID,
                gameState: snapshot,
                format: GameFormat.CASH,
                variant: GameVariant.TEXAS_HOLDEM,
                name: "My Table",
            },
        };

        const result = classifyMessage(message, TABLE_ID);

        expect(result.kind).toBe("state");
        if (result.kind !== "state") throw new Error("expected state");
        expect(result.snapshot).toBe(snapshot);
        expect(result.format).toBe(GameFormat.CASH);
        expect(result.variant).toBe(GameVariant.TEXAS_HOLDEM);
        expect(result.name).toBe("My Table");
        expect(result.validationError).toBeNull();
    });

    it("infers SIT_AND_GO from a tournamentId when no explicit format is sent", () => {
        // Tournament tables carry no format field, only a tournamentId. Without this
        // inference the table is treated as cash and chip amounts divide by 1e6.
        const snapshot = makeState({ tournamentId: "0x7398acda" } as Partial<TexasHoldemStateDTO>);
        const message: RawWsMessage = {
            event: "state",
            gameId: TABLE_ID,
            data: { gameId: TABLE_ID, gameState: snapshot }, // no format
        };
        const result = classifyMessage(message, TABLE_ID);
        expect(result.kind).toBe("state");
        if (result.kind !== "state") throw new Error("expected state");
        expect(result.format).toBe(GameFormat.SIT_AND_GO);
    });

    it("an explicit format still wins over the tournamentId inference", () => {
        const snapshot = makeState({ tournamentId: "0xabc" } as Partial<TexasHoldemStateDTO>);
        const message: RawWsMessage = {
            event: "state",
            gameId: TABLE_ID,
            data: { gameId: TABLE_ID, gameState: snapshot, format: GameFormat.CASH },
        };
        const result = classifyMessage(message, TABLE_ID);
        if (result.kind !== "state") throw new Error("expected state");
        expect(result.format).toBe(GameFormat.CASH);
    });

    it("passes through an explicit \"tournament\" format (multi-table tournaments, not just sit-and-go)", () => {
        // A scheduled multi-table tournament table sends format "tournament". It must
        // survive as GameFormat.TOURNAMENT so the table renders in chips, not cash.
        const snapshot = makeState();
        const message: RawWsMessage = {
            event: "state",
            gameId: TABLE_ID,
            data: { gameId: TABLE_ID, gameState: snapshot, format: GameFormat.TOURNAMENT },
        };
        const result = classifyMessage(message, TABLE_ID);
        if (result.kind !== "state") throw new Error("expected state");
        expect(result.format).toBe(GameFormat.TOURNAMENT);
    });

    it("infers SIT_AND_GO from a non-zero startingStack when neither format nor tournamentId is sent", () => {
        // The real cause of the "$0.000 blinds" bug: some tournament frames carry no
        // format AND no tournamentId. Every cash table reports startingStack "0", so a
        // positive starting stack is the reliable tell.
        const snapshot = makeState({
            gameOptions: { ...makeState().gameOptions, startingStack: "1500" },
        });
        const message: RawWsMessage = {
            event: "state",
            gameId: TABLE_ID,
            data: { gameId: TABLE_ID, gameState: snapshot }, // no format, no tournamentId
        };
        const result = classifyMessage(message, TABLE_ID);
        if (result.kind !== "state") throw new Error("expected state");
        expect(result.format).toBe(GameFormat.SIT_AND_GO);
    });

    it("leaves format undefined for a cash table (startingStack 0, no format/tournamentId)", () => {
        const snapshot = makeState({
            gameOptions: { ...makeState().gameOptions, startingStack: "0" },
        });
        const message: RawWsMessage = {
            event: "state",
            gameId: TABLE_ID,
            data: { gameId: TABLE_ID, gameState: snapshot },
        };
        const result = classifyMessage(message, TABLE_ID);
        if (result.kind !== "state") throw new Error("expected state");
        expect(result.format).toBeUndefined();
    });

    it("ignores a state-bearing message for a different table", () => {
        const message: RawWsMessage = {
            event: "state",
            gameId: "some-other-table",
            data: { gameId: "some-other-table", gameState: makeState() },
        };

        const result = classifyMessage(message, TABLE_ID);

        expect(result.kind).toBe("ignore");
    });

    it("classifies a state-bearing event with no gameState payload as validationErrorNoState", () => {
        const message: RawWsMessage = {
            event: "state",
            gameId: TABLE_ID,
            data: { gameId: TABLE_ID },
        };

        const result = classifyMessage(message, TABLE_ID);

        expect(result.kind).toBe("validationErrorNoState");
        if (result.kind !== "validationErrorNoState") throw new Error("expected validationErrorNoState");
        expect(result.validationError.missingFields).toContain("gameState");
        expect(result.validationError.message).toBe("No game state data received from server");
    });

    it("classifies a pending event with data present, populating PendingAction fields", () => {
        const message: RawWsMessage = {
            event: "pending",
            gameId: TABLE_ID,
            data: {
                gameId: TABLE_ID,
                actor: "0xabc",
                action: "raise",
                amount: "50000",
            },
        };

        const result = classifyMessage(message, TABLE_ID);

        expect(result.kind).toBe("pending");
        if (result.kind !== "pending") throw new Error("expected pending");
        expect(result.pendingAction.gameId).toBe(TABLE_ID);
        expect(result.pendingAction.actor).toBe("0xabc");
        expect(result.pendingAction.action).toBe("raise");
        expect(result.pendingAction.amount).toBe("50000");
        expect(typeof result.pendingAction.timestamp).toBe("number");
    });

    it("falls back to message.gameId when data.gameId is absent on a pending event", () => {
        const message: RawWsMessage = {
            event: "pending",
            gameId: TABLE_ID,
            data: {
                actor: "0xabc",
                action: "call",
            },
        };

        const result = classifyMessage(message, TABLE_ID);

        expect(result.kind).toBe("pending");
        if (result.kind !== "pending") throw new Error("expected pending");
        expect(result.pendingAction.gameId).toBe(TABLE_ID);
    });

    it("classifies an action_accepted event as kind:actionAccepted", () => {
        const message: RawWsMessage = {
            event: "action_accepted",
            gameId: TABLE_ID,
        };

        const result = classifyMessage(message, TABLE_ID);

        expect(result.kind).toBe("actionAccepted");
    });

    it("classifies a GAME_NOT_FOUND error with clearGameState true", () => {
        const message: RawWsMessage = {
            type: "error",
            code: "GAME_NOT_FOUND",
            message: "Game not found",
            details: { suggestion: "Try a different table." },
        };

        const result = classifyMessage(message, TABLE_ID);

        expect(result.kind).toBe("error");
        if (result.kind !== "error") throw new Error("expected error");
        expect(result.clearGameState).toBe(true);
        expect(result.error.message).toContain("Game not found");
        expect(result.error.message).toContain("Try a different table.");
    });

    it("classifies a non-GAME_NOT_FOUND error with clearGameState false", () => {
        const message: RawWsMessage = {
            type: "error",
            code: "SOME_OTHER_CODE",
            message: "Something else went wrong",
        };

        const result = classifyMessage(message, TABLE_ID);

        expect(result.kind).toBe("error");
        if (result.kind !== "error") throw new Error("expected error");
        expect(result.clearGameState).toBe(false);
        expect(result.error.message).toBe("Something else went wrong");
    });

    it("extracts gameState from message.data.gameState when both data and state are present", () => {
        const dataSnapshot = makeState({ handNumber: 7 });
        const stateSnapshot = makeState({ handNumber: 99 });
        const message: RawWsMessage = {
            event: "state",
            gameId: TABLE_ID,
            data: { gameId: TABLE_ID, gameState: dataSnapshot },
            state: { gameId: TABLE_ID, gameState: stateSnapshot },
        };

        const result = classifyMessage(message, TABLE_ID);

        expect(result.kind).toBe("state");
        if (result.kind !== "state") throw new Error("expected state");
        expect(result.snapshot).toBe(dataSnapshot);
    });

    it("falls back to message.state.gameState when message.data.gameState is absent", () => {
        const stateSnapshot = makeState({ handNumber: 42 });
        const message: RawWsMessage = {
            event: "state",
            gameId: TABLE_ID,
            state: { gameId: TABLE_ID, gameState: stateSnapshot },
        };

        const result = classifyMessage(message, TABLE_ID);

        expect(result.kind).toBe("state");
        if (result.kind !== "state") throw new Error("expected state");
        expect(result.snapshot).toBe(stateSnapshot);
    });

    it("ignores an unrecognized message shape with no matching type/event", () => {
        const message: RawWsMessage = {
            type: "subscribed",
        };

        const result = classifyMessage(message, TABLE_ID);

        expect(result.kind).toBe("ignore");
    });

    it("ignores null input", () => {
        expect(classifyMessage(null, TABLE_ID).kind).toBe("ignore");
    });

    it("ignores undefined input", () => {
        expect(classifyMessage(undefined, TABLE_ID).kind).toBe("ignore");
    });
});
