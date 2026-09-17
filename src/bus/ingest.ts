/**
 * WS message classifier.
 *
 * `classifyMessage` takes a single parsed WebSocket message plus the table it
 * belongs to and returns a discriminated {@link ClassifiedMessage} describing
 * exactly what the caller should do with it — no React, no side effects, fully
 * unit-testable.
 *
 * Two distinct validation outcomes are modeled in the type (surface, never silently default):
 *   - a message with NO gameState → `validationErrorNoState` (nothing committed)
 *   - a message with an invalid-but-present gameState → `state` with a non-null
 *     `validationError` (the snapshot is still committed so the table renders
 *     what it can, while the error is surfaced)
 *
 * This port does not yet implement the gameOptions/format/variant validation `ui`'s
 * `validateGameState` performs — `validationError` on the `state` branch is therefore
 * always `null` today. The type and the provider's branch handling it are kept as-is
 * so this behavior can be added later without changing the contract.
 */
import { TexasHoldemStateDTO, GameFormat, GameVariant } from "@block52/poker-vm-sdk";
import type { ValidationError, PendingAction } from "./types";

/**
 * Cosmos event names that carry a full game-state snapshot.
 *
 * `optimistic` is the relay's mempool-arrival push: the same {gameId, ...,
 * gameState} shape as a committed frame, but projected from a pending action
 * before it commits. It carries the full state and reconciles automatically —
 * the subsequent `action_performed` commit frame is the authoritative snapshot
 * (same PVM → same state) — so it's rendered like any other state-bearing event.
 */
const COSMOS_STATE_EVENTS = ["state", "optimistic", "player_joined_game", "action_performed", "game_created"];

/**
 * Loosely-typed inbound WS envelope. There is no SDK type for the transport
 * envelope itself (only for the `gameState` payload it wraps), so this mirrors
 * every field the handler reads. `JSON.parse` output assigns to it without a cast.
 */
export interface RawWsMessage {
    type?: string;
    event?: string;
    gameId?: string;
    tableAddress?: string;
    code?: string;
    message?: string;
    details?: { suggestion?: string };
    data?: {
        gameId?: string;
        actor?: string;
        action?: string;
        amount?: string;
        gameState?: TexasHoldemStateDTO;
        format?: string;
        variant?: string;
        name?: string;
    };
    state?: {
        gameId?: string;
        format?: string;
        variant?: string;
        gameState?: unknown;
    };
}

/**
 * Discriminated result of classifying one inbound message.
 *
 * `ignore` covers everything the caller should drop silently: gateway
 * `subscribed`/ack frames, unknown message types, and frames for a different table.
 */
export type ClassifiedMessage =
    | {
          kind: "state";
          snapshot: TexasHoldemStateDTO;
          format: GameFormat | undefined;
          variant: GameVariant | undefined;
          /** Optional ENS-style table name; undefined for unnamed tables. */
          name: string | undefined;
          /** null = valid; non-null = invalid but still committed. */
          validationError: ValidationError | null;
      }
    | {
          kind: "validationErrorNoState";
          validationError: ValidationError;
      }
    | { kind: "pending"; pendingAction: PendingAction }
    | { kind: "actionAccepted" }
    | {
          kind: "error";
          error: Error;
          /** true for GAME_NOT_FOUND — the existing game state is cleared. */
          clearGameState: boolean;
      }
    | { kind: "ignore" };

function toGameFormat(raw: string | undefined): GameFormat | undefined {
    if (raw === undefined) return undefined;
    return Object.values(GameFormat).includes(raw as GameFormat) ? (raw as GameFormat) : undefined;
}

function toGameVariant(raw: string | undefined): GameVariant | undefined {
    if (raw === undefined) return undefined;
    return Object.values(GameVariant).includes(raw as GameVariant) ? (raw as GameVariant) : undefined;
}

function extractGameDataFromMessage(message: RawWsMessage): {
    gameState: TexasHoldemStateDTO | undefined;
    format: string | undefined;
    variant: string | undefined;
    name: string | undefined;
} {
    const fromData = message.data?.gameState;
    const fromState = message.state?.gameState as TexasHoldemStateDTO | undefined;
    return {
        gameState: fromData ?? fromState,
        format: message.data?.format ?? message.state?.format,
        variant: message.data?.variant ?? message.state?.variant,
        name: message.data?.name,
    };
}

/**
 * Classify a single parsed WebSocket message for the given table.
 *
 * @param raw - the parsed message (cosmos/PVM shape)
 * @param tableId - the table the caller is currently subscribed to
 */
export function classifyMessage(raw: RawWsMessage | null | undefined, tableId: string): ClassifiedMessage {
    if (!raw || typeof raw !== "object") {
        return { kind: "ignore" };
    }

    const message: RawWsMessage = raw;

    const isStateUpdate =
        (message.type === "gameStateUpdate" && message.tableAddress === tableId) ||
        (message.event !== undefined && COSMOS_STATE_EVENTS.includes(message.event) && message.gameId === tableId);

    if (isStateUpdate) {
        const { gameState: gameStateData, format: rawFormat, variant: rawVariant, name } = extractGameDataFromMessage(message);

        if (!gameStateData) {
            return {
                kind: "validationErrorNoState",
                validationError: {
                    missingFields: ["gameState"],
                    message: "No game state data received from server",
                    rawData: message,
                },
            };
        }

        return {
            kind: "state",
            snapshot: gameStateData,
            format: toGameFormat(rawFormat),
            variant: toGameVariant(rawVariant),
            name,
            validationError: null,
        };
    }

    if (message.event === "pending") {
        const pendingData = message.data;
        if (pendingData) {
            return {
                kind: "pending",
                pendingAction: {
                    gameId: pendingData.gameId || message.gameId || "",
                    actor: pendingData.actor ?? "",
                    action: pendingData.action ?? "",
                    amount: pendingData.amount,
                    timestamp: Date.now(),
                },
            };
        }
        return { kind: "ignore" };
    }

    if (message.event === "action_accepted") {
        return { kind: "actionAccepted" };
    }

    if (message.type === "error" || message.event === "error") {
        const errorMsg =
            message.code === "GAME_NOT_FOUND"
                ? `${message.message}${message.details?.suggestion ? "\n\n" + message.details.suggestion : ""}`
                : message.message || "An error occurred";

        return {
            kind: "error",
            error: new Error(errorMsg),
            clearGameState: message.code === "GAME_NOT_FOUND",
        };
    }

    return { kind: "ignore" };
}
