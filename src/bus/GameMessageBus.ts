/**
 * GameMessageBus — synchronous classify+derive ingest pipeline between the
 * WebSocket and React state.
 *
 * Plain TypeScript, no React imports, fully unit-testable. Responsibilities:
 *   1. classify each raw message (via classifyMessage);
 *   2. assign a strictly-monotonic `seq`;
 *   3. derive the typed transitions (deriveEvents) against the last ingested
 *      snapshot;
 *   4. track the last-seen snapshot;
 *   5. return the fully-derived item synchronously — there is no queue, no
 *      pacing, no decorators (see the design note in the implementation plan
 *      for why: without animation choreography there is nothing for a
 *      "logical track" to race ahead of).
 */
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { classifyMessage, type ClassifiedMessage, type RawWsMessage } from "./ingest";
import type { GameStreamItem, GameEvent } from "./types";
import { deriveEvents } from "./deriveEvents";

export interface GameMessageBusOptions {
    /** Clock for `receivedAt`; defaults to performance.now(). */
    now?: () => number;
}

export class GameMessageBus {
    private readonly now: () => number;
    private seq = 0;
    private lastSnapshot: TexasHoldemStateDTO | undefined = undefined;

    constructor(options: GameMessageBusOptions = {}) {
        this.now = options.now ?? (() => performance.now());
    }

    /**
     * Ingest a single parsed WS message for `tableId`. Returns the derived item,
     * or null for frames that should be dropped silently (acks, unknown types,
     * wrong-table frames).
     */
    public ingest(raw: RawWsMessage, tableId: string): GameStreamItem | null {
        const classified = classifyMessage(raw, tableId);

        if (classified.kind === "ignore") {
            return null;
        }

        const prevSnapshot = this.lastSnapshot;
        this.updateSnapshot(classified);

        this.seq += 1;

        return {
            seq: this.seq,
            receivedAt: this.now(),
            kind: classified.kind,
            classified,
            events: this.deriveEventsForItem(classified, prevSnapshot),
            raw,
        };
    }

    /** Clear the last-seen snapshot (on unsubscribe/resubscribe). `seq` is never reset. */
    public reset(): void {
        this.lastSnapshot = undefined;
    }

    /** The most recent snapshot seen at ingest. */
    public getLastSnapshot(): TexasHoldemStateDTO | undefined {
        return this.lastSnapshot;
    }

    private deriveEventsForItem(classified: ClassifiedMessage, prev: TexasHoldemStateDTO | undefined): GameEvent[] {
        if (classified.kind !== "state") {
            return [];
        }
        try {
            return deriveEvents(prev, classified.snapshot);
        } catch (err) {
            console.error("[GameMessageBus] event derivation failed:", (err as Error).message);
            return [];
        }
    }

    private updateSnapshot(classified: ClassifiedMessage): void {
        if (classified.kind === "state") {
            this.lastSnapshot = classified.snapshot;
        } else if (classified.kind === "error" && classified.clearGameState) {
            this.lastSnapshot = undefined;
        }
    }
}
