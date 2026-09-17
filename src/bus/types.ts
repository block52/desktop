/**
 * WS ingest types — envelope and event shapes for the simplified (logical-track-only)
 * game message pipeline. Snapshot/action/format/variant types come from the SDK.
 */
import type { TexasHoldemStateDTO, ActionDTO, WinnerDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";
import type { ClassifiedMessage } from "./ingest";

/** Typed transitions derived by diffing prev/next snapshot at ingest (see deriveEvents). */
export type GameEvent =
    | { type: "handStarted"; handNumber: number }
    | { type: "playerActed"; action: ActionDTO }
    | { type: "roundAdvanced"; from: TexasHoldemRound; to: TexasHoldemRound; newCommunityCards: string[] }
    | { type: "handEnded"; winners: WinnerDTO[] }
    | { type: "playerJoined"; seat: number; address: string }
    | { type: "playerLeft"; seat: number; address: string }
    | { type: "stackChanged"; seat: number; from: string; to: string }
    | { type: "cardsRevealed"; seat: number; cards: string[] };

export type GameEventType = GameEvent["type"];

/** A validation problem surfaced alongside (not instead of) a committed snapshot. */
export interface ValidationError {
    missingFields: string[];
    message: string;
    rawData?: unknown;
}

/** An optimistic "player is about to act" hint, before the action-bearing snapshot arrives. */
export interface PendingAction {
    gameId: string;
    actor: string;
    action: string;
    amount?: string;
    timestamp: number;
}

/**
 * One fully-derived item produced by a single `ingest()` call. Unlike ui's
 * GameStreamItem, this carries no `decoration`/`synthetic` fields — there is no
 * animation pacing or frame expansion in this simplified pipeline (Stage 2b concern).
 */
export interface GameStreamItem {
    /** Assigned at ingest, strictly monotonic, never reused across resets. */
    seq: number;
    /** performance.now() (or injected clock) at ingest. */
    receivedAt: number;
    kind: ClassifiedMessage["kind"];
    classified: ClassifiedMessage;
    /** Derived transitions for this commit (empty for non-state items). */
    events: GameEvent[];
    /** Original parsed message, for error surfaces / debugging. */
    raw: unknown;
}
