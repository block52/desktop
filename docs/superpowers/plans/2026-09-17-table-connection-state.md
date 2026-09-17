# Table Connection & Game State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the `desktop` Electron app a live WebSocket connection to a joined table, with a simplified "logical-track-only" ingest pipeline (classify → derive typed events → apply state immediately, no animation pacing) feeding one unified game-state React context — the connection/state foundation Stage 2a's player actions (Plan 2) and table UI (Plan 3) build on.

**Architecture:** Port `ui`'s message-classification (`classifyMessage`) and event-derivation (`deriveEvents`) logic near-verbatim (both are pure, already well-tested pure functions). Replace `ui`'s `GameMessageBus` — which bundles event derivation with a paced/decorated/backpressured render queue — with a much smaller bus that does ingest+derive+commit synchronously in one call, since without animation pacing there is no longer a meaningful split between a "logical track" (fed immediately) and a "render track" (paced): they collapse into the same update. Port `ui`'s WebSocket connection lifecycle and Cosmos-based WS-auth signing into one unified `GameStateProvider`/`useGameState()` context (not `ui`'s 5-slice split).

**Tech Stack:** React 19, TypeScript, native `WebSocket`, `@block52/poker-vm-sdk` (already a dependency), `ethers` (new dependency, for WS-auth message signing only — matches `ui`'s usage, not a Cosmos SDK transaction).

**Spec:** `docs/superpowers/specs/2026-09-17-table-game-flow-design.md`

## Global Constraints

- Quotes: always double quotes in `.ts`/`.tsx` (repo CLAUDE.md).
- No `||`/`??` fallback for SDK values (repo CLAUDE.md) — this plan introduces none against SDK-typed values; existing `??` on non-SDK config env vars elsewhere in the repo is out of scope.
- No `any` type (repo CLAUDE.md).
- Package manager: yarn, never npm.
- New dependency: `ethers` at `^6.15.0` (matches `ui`'s pinned version).
- SDK types (`TexasHoldemStateDTO`, `ActionDTO`, `PlayerDTO`, `WinnerDTO`, `TexasHoldemRound`, `GameFormat`, `GameVariant`) come from `@block52/poker-vm-sdk` — already exported from its root (verified against `node_modules/@block52/poker-vm-sdk/dist/index.d.ts`), never redefined locally.
- Scope boundary (per spec): no animation pacing, no decorators, no backpressure/coalescing, no all-in-runout frame expansion, no 5-slice context split, no `Replay` mode, no action-submission code (that's Plan 2). This plan's deliverable is proven by a temporary raw-state dump in `Table.tsx`, not a real table UI (that's Plan 3).

---

### Task 1: CSP — allow production WebSocket endpoints

**Files:**
- Modify: `src/main.ts:53`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing later tasks import — this unblocks real network connections for every later task's manual verification.

- [ ] **Step 1: Add the production `wss://` hosts to `connect-src`**

Current line 53:
```ts
          "connect-src 'self' ws://localhost:* wss://localhost:* http://localhost:* https: wss://relay.walletconnect.org wss://relay.walletconnect.com; " +
```

Change to (adds the three non-localhost `ws` endpoints from `NetworkContext.tsx`'s `NETWORK_PRESETS` — Block52, Texas Hodl, Miller Services; `Localhost`'s `ws://localhost:8585/ws` is already covered by the existing `ws://localhost:*`):

```ts
          "connect-src 'self' ws://localhost:* wss://localhost:* http://localhost:* https: wss://relay.walletconnect.org wss://relay.walletconnect.com wss://node1.block52.xyz wss://node.texashodl.net wss://node.tommillerservices.com; " +
```

- [ ] **Step 2: Verify**

Run: `yarn lint`
Expected: no new errors.

Run: `yarn start`, confirm the app still boots (this change only loosens CSP, no functional change yet to verify beyond a clean boot).

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "chore: allow production WebSocket endpoints in CSP for table connections"
```

---

### Task 2: Guard utilities

**Files:**
- Create: `src/utils/guards.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `hasElements<T>(arr: T[] | null | undefined): arr is T[]`, `isEmpty<T>(arr: T[] | null | undefined): boolean` (named exports) — consumed by `deriveEvents.ts` (Task 4).

- [ ] **Step 1: Create `src/utils/guards.ts`**

```ts
/**
 * Type guard utilities for common null/undefined/empty checks.
 * Mirrors pvm/ts/src/utils/guards.ts for consistency across the stack.
 */

export function hasValue<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}

export function isNullish(value: unknown): value is null | undefined {
    return value === null || value === undefined;
}

export function isEmpty<T>(arr: T[] | null | undefined): boolean {
    return !arr || arr.length === 0;
}

export function hasElements<T>(arr: T[] | null | undefined): arr is T[] {
    return arr !== null && arr !== undefined && arr.length > 0;
}

export function safeLength<T>(arr: T[] | null | undefined): number {
    return arr?.length ?? 0;
}

export function isBlank(value: string | null | undefined): boolean {
    return value === null || value === undefined || value === "";
}

export function hasContent(value: string | null | undefined): value is string {
    return value !== null && value !== undefined && value !== "";
}
```

- [ ] **Step 2: Verify**

Run: `yarn lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/guards.ts
git commit -m "feat: add type guard utilities for the game-state ingest pipeline"
```

---

### Task 3: Message classification (`classifyMessage`)

**Files:**
- Create: `src/bus/types.ts`
- Create: `src/bus/ingest.ts`

**Interfaces:**
- Consumes: SDK types (`TexasHoldemStateDTO`, `GameFormat`, `GameVariant`).
- Produces: `GameEvent`/`GameEventType` (types), `RawWsMessage`, `ClassifiedMessage`, `classifyMessage(raw: RawWsMessage | null | undefined, tableId: string): ClassifiedMessage` (all named exports from `src/bus/ingest.ts`; `GameEvent` from `src/bus/types.ts`) — consumed by Task 4 (`deriveEvents`), Task 6 (the bus), and Task 7 (the context).

Note: this task also defines `ValidationError` and `PendingAction` — in `ui` these live in `components/playPage/TableErrorPage.tsx` and `context/gameState/GameUIContext.tsx` respectively, neither of which exists in `desktop` yet (both are Plan 3/out-of-scope-for-2a-slice-split concerns). Since they're small, stable shapes needed now, they're declared directly in `src/bus/types.ts` for this plan; Plan 3 can re-export or relocate them if `TableErrorPage`'s own file becomes the more natural home once it exists.

- [ ] **Step 1: Create `src/bus/types.ts`**

```ts
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
```

- [ ] **Step 2: Create `src/bus/ingest.ts`**

```ts
/**
 * WS message classifier.
 *
 * `classifyMessage` takes a single parsed WebSocket message plus the table it
 * belongs to and returns a discriminated {@link ClassifiedMessage} describing
 * exactly what the caller should do with it — no React, no side effects, fully
 * unit-testable.
 *
 * Two distinct validation outcomes (surface, never silently default):
 *   - a message with NO gameState → `validationErrorNoState` (nothing committed)
 *   - a message with an invalid-but-present gameState → `state` with a non-null
 *     `validationError` (the snapshot is still committed so the table renders
 *     what it can, while the error is surfaced).
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
```

Note on `toGameFormat`/`toGameVariant`/`extractGameDataFromMessage`: `ui` imports these from `utils/gameFormatUtils.ts`, a larger shared utility file `desktop` doesn't have. Rather than porting that whole file for three small functions, this task inlines minimal equivalents scoped to `ingest.ts`'s own needs. If Plan 2/3 need the same helpers elsewhere, promote them to a shared `src/utils/gameFormatUtils.ts` then — don't duplicate a second copy.

- [ ] **Step 3: Verify**

Run: `yarn lint`
Expected: no new errors. `GameFormat`/`GameVariant` are SDK enums — confirm `Object.values(GameFormat)` compiles (it does for a TypeScript `enum`).

- [ ] **Step 4: Commit**

```bash
git add src/bus/types.ts src/bus/ingest.ts
git commit -m "feat: add WS message classification for the game-state ingest pipeline"
```

---

### Task 4: Event derivation (`deriveEvents`)

**Files:**
- Create: `src/bus/deriveEvents.ts`
- Test: `src/bus/deriveEvents.test.ts`

**Interfaces:**
- Consumes: `GameEvent` (Task 3, `src/bus/types.ts`), `hasElements`/`isEmpty` (Task 2, `src/utils/guards.ts`).
- Produces: `deriveEvents(prev: TexasHoldemStateDTO | undefined, next: TexasHoldemStateDTO): GameEvent[]`, `RegressedSnapshotError`, `isMaskedHand`, `isRevealedHand` (named exports from `src/bus/deriveEvents.ts`) — consumed by Task 6 (the bus).

This is a pure function ported near-verbatim from `ui` — a strong TDD candidate. Steps below follow red/green.

- [ ] **Step 1: Write the failing tests**

Create `src/bus/deriveEvents.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/bus/deriveEvents.test.ts`
Expected: FAIL — `Cannot find module './deriveEvents'`.

- [ ] **Step 3: Write the implementation**

Create `src/bus/deriveEvents.ts`:

```ts
/**
 * Event derivation.
 *
 * `deriveEvents(prev, next)` is a PURE function that diffs two consecutive game
 * snapshots and returns the typed transitions that happened between them.
 *
 * Key semantics:
 *
 *   - Action indices are GLOBALLY MONOTONIC across hands. The `previousActions`
 *     array is replaced with the current hand's actions each hand, but indices
 *     keep climbing. So the dedup baseline is simply the max index present in
 *     `prev.previousActions` — the persistent `lastSeenIndex`, with NO per-hand
 *     reset. Every `previousActions` entry in `next` with `index > baseline`
 *     yields one `playerActed`, in index order.
 *
 *   - `prev === undefined` (first frame after subscribe/reset) → NO synthetic
 *     events. History is not replayed as fresh events; the frame simply becomes
 *     the baseline for the next call.
 *
 *   - A regressed snapshot (indices go backwards while the hand number is
 *     unchanged) is NOT silently accepted — it throws {@link RegressedSnapshotError}.
 *     The caller should surface this (e.g. console.error) and still commit the
 *     frame with no events — the snapshot itself is never dropped.
 */
import type { TexasHoldemStateDTO, ActionDTO, PlayerDTO } from "@block52/poker-vm-sdk";
import { TexasHoldemRound } from "@block52/poker-vm-sdk";
import type { GameEvent } from "./types";
import { hasElements, isEmpty } from "../utils/guards";

/**
 * Thrown by {@link deriveEvents} when a same-hand snapshot's action indices
 * regress (a stale/out-of-order frame). Surfaced by the caller, never swallowed.
 */
export class RegressedSnapshotError extends Error {
    public readonly prevMaxIndex: number;
    public readonly nextMaxIndex: number;
    public readonly handNumber: number;

    constructor(prevMaxIndex: number, nextMaxIndex: number, handNumber: number) {
        super(
            `Regressed snapshot: previousActions max index went backwards from ${prevMaxIndex} to ${nextMaxIndex} ` +
                `without a handNumber change (hand ${handNumber}). Refusing to derive events from a stale frame.`
        );
        this.name = "RegressedSnapshotError";
        this.prevMaxIndex = prevMaxIndex;
        this.nextMaxIndex = nextMaxIndex;
        this.handNumber = handNumber;
    }
}

const ROUND_ORDER: readonly TexasHoldemRound[] = [
    TexasHoldemRound.ANTE,
    TexasHoldemRound.PREFLOP,
    TexasHoldemRound.FLOP,
    TexasHoldemRound.TURN,
    TexasHoldemRound.RIVER,
    TexasHoldemRound.SHOWDOWN,
    TexasHoldemRound.END,
];

function roundOrder(round: TexasHoldemRound): number {
    return ROUND_ORDER.indexOf(round);
}

function maxActionIndex(actions: readonly ActionDTO[] | undefined): number | null {
    if (!actions || actions.length === 0) {
        return null;
    }
    let max = actions[0].index;
    for (const action of actions) {
        if (action.index > max) {
            max = action.index;
        }
    }
    return max;
}

function isMaskedCard(card: string): boolean {
    return card === "X" || card === "??";
}

export function isMaskedHand(cards: string[] | undefined): boolean {
    return hasElements(cards) && cards.every(isMaskedCard);
}

export function isRevealedHand(cards: string[] | undefined): boolean {
    return hasElements(cards) && cards.every(card => !isMaskedCard(card));
}

function playersBySeat(players: readonly PlayerDTO[]): Map<number, PlayerDTO> {
    const map = new Map<number, PlayerDTO>();
    for (const player of players) {
        map.set(player.seat, player);
    }
    return map;
}

/**
 * Derive the typed transitions between two consecutive snapshots.
 *
 * @throws {RegressedSnapshotError} when same-hand action indices regress.
 */
export function deriveEvents(prev: TexasHoldemStateDTO | undefined, next: TexasHoldemStateDTO): GameEvent[] {
    if (prev === undefined) {
        return [];
    }

    const handAdvanced = next.handNumber > prev.handNumber;
    const sameHand = next.handNumber === prev.handNumber;

    const prevMax = maxActionIndex(prev.previousActions);
    const nextMax = maxActionIndex(next.previousActions);

    if (sameHand && prevMax !== null && nextMax !== null && nextMax < prevMax) {
        throw new RegressedSnapshotError(prevMax, nextMax, next.handNumber);
    }

    const events: GameEvent[] = [];

    const prevSeats = playersBySeat(prev.players);
    const nextSeats = playersBySeat(next.players);
    for (const [seat, player] of nextSeats) {
        if (!prevSeats.has(seat)) {
            events.push({ type: "playerJoined", seat, address: player.address });
        }
    }
    for (const [seat, player] of prevSeats) {
        if (!nextSeats.has(seat)) {
            events.push({ type: "playerLeft", seat, address: player.address });
        }
    }

    if (handAdvanced) {
        events.push({ type: "handStarted", handNumber: next.handNumber });
    }

    const baseline = prevMax ?? -1;
    const newActions = next.previousActions.filter(action => action.index > baseline).sort((a, b) => a.index - b.index);
    for (const action of newActions) {
        events.push({ type: "playerActed", action });
    }

    if (sameHand && next.round !== prev.round && roundOrder(next.round) > roundOrder(prev.round)) {
        const newCommunityCards = next.communityCards.slice(prev.communityCards.length);
        events.push({ type: "roundAdvanced", from: prev.round, to: next.round, newCommunityCards });
    }

    for (const [seat, nextPlayer] of nextSeats) {
        const prevPlayer = prevSeats.get(seat);
        if (prevPlayer && isMaskedHand(prevPlayer.holeCards) && isRevealedHand(nextPlayer.holeCards)) {
            events.push({ type: "cardsRevealed", seat, cards: nextPlayer.holeCards as string[] });
        }
    }

    for (const [seat, nextPlayer] of nextSeats) {
        const prevPlayer = prevSeats.get(seat);
        if (prevPlayer && prevPlayer.stack !== nextPlayer.stack) {
            events.push({ type: "stackChanged", seat, from: prevPlayer.stack, to: nextPlayer.stack });
        }
    }

    if (hasElements(next.winners) && isEmpty(prev.winners)) {
        events.push({ type: "handEnded", winners: next.winners });
    }

    return events;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/bus/deriveEvents.test.ts`
Expected: PASS, all 9 tests green.

- [ ] **Step 5: Verify lint**

Run: `yarn lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/bus/deriveEvents.ts src/bus/deriveEvents.test.ts
git commit -m "feat: add pure event-derivation logic for game-state snapshots"
```

---

### Task 5: WebSocket-auth signing

**Files:**
- Create: `src/utils/cosmos/signing.ts`
- Modify: `package.json` (add `ethers` dependency)

**Interfaces:**
- Consumes: `getCosmosMnemonic` (existing, `src/utils/cosmos/storage.ts`), `getCosmosAddress` (existing, same file).
- Produces: `createAuthPayload(): Promise<{ playerAddress: string; timestamp: number; signature: string } | null>` (named export) — consumed by Task 7 (`GameStateProvider`).

This is the WebSocket subscription handshake signature — an `ethers` `personal_sign` (EIP-191) over a plain challenge string, using the same Cosmos-derivation HD path `ui` uses. It is **not** a Cosmos SDK transaction and does not touch `desktop`'s existing `getSigningClient`/`createSigningClientFromMnemonic` transaction-signing path (Stage 1's deposit/withdraw code) — a separate, smaller signing concern.

- [ ] **Step 1: Add `ethers`**

Run: `yarn add ethers@^6.15.0`
Expected: added to `package.json`/`yarn.lock`.

- [ ] **Step 2: Create `src/utils/cosmos/signing.ts`**

```ts
/**
 * Cosmos query signing utilities.
 *
 * Used to prove player identity when subscribing to a table over WebSocket
 * (the server uses this to return the player's own hole cards while masking
 * everyone else's). This is a plain message signature, not a Cosmos SDK
 * transaction — it does not use the signing-client path deposit/withdraw use.
 *
 * Message format: "pokerchain-query:<timestamp>"
 * Signature format: Ethereum personal_sign (EIP-191)
 */
import { ethers } from "ethers";
import { getCosmosMnemonic, getCosmosAddress } from "./storage";

// Cosmos HD derivation path (same path the wallet/signing-client code already uses).
const COSMOS_HD_PATH = "m/44'/118'/0'/0/0";

/**
 * Signs a query message with the user's mnemonic for WebSocket authentication.
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns The hex-encoded signature with 0x prefix, or null if no mnemonic
 */
export async function signQueryMessage(timestamp: number): Promise<string | null> {
    const mnemonic = getCosmosMnemonic();
    if (!mnemonic) {
        console.error("[signing] No mnemonic found in storage");
        return null;
    }

    try {
        const message = `pokerchain-query:${timestamp}`;
        const hdWallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, COSMOS_HD_PATH);
        const signature = await hdWallet.signMessage(message);
        return signature;
    } catch (error) {
        console.error("[signing] Failed to sign query message:", error);
        return null;
    }
}

/**
 * Creates a signed authentication payload for WebSocket subscription.
 *
 * @returns Authentication payload with address, timestamp, and signature, or null if signing fails
 */
export async function createAuthPayload(): Promise<{
    playerAddress: string;
    timestamp: number;
    signature: string;
} | null> {
    const mnemonic = getCosmosMnemonic();
    if (!mnemonic) {
        console.error("[signing] No mnemonic found for auth payload");
        return null;
    }

    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = await signQueryMessage(timestamp);

        if (!signature) {
            return null;
        }

        const cosmosAddress = getCosmosAddress();
        if (!cosmosAddress) {
            console.error("[signing] No Cosmos address found in storage");
            return null;
        }

        return {
            playerAddress: cosmosAddress,
            timestamp,
            signature,
        };
    } catch (error) {
        console.error("[signing] Failed to create auth payload:", error);
        return null;
    }
}
```

Note: this reuses `desktop`'s existing `getCosmosAddress()` (`src/utils/cosmos/storage.ts`) directly instead of `ui`'s `STORAGE_KEYS.cosmosAddress` + raw `localStorage.getItem` — `desktop` already has this function, no need to introduce a parallel storage-key constants file.

- [ ] **Step 3: Verify**

Run: `yarn lint`
Expected: no new errors.

Run: `npx tsc --noEmit 2>&1 | grep "signing.ts"`
Expected: no output (no new type errors in this file). Pre-existing unrelated errors elsewhere are expected (see Stage 1 precedent) and not a gate.

- [ ] **Step 4: Commit**

```bash
git add package.json yarn.lock src/utils/cosmos/signing.ts
git commit -m "feat: add WebSocket-auth message signing for table subscriptions"
```

---

### Task 6: Simplified game message bus

**Files:**
- Create: `src/bus/GameMessageBus.ts`
- Test: `src/bus/GameMessageBus.test.ts`

**Interfaces:**
- Consumes: `classifyMessage`/`RawWsMessage`/`ClassifiedMessage` (Task 3), `GameStreamItem`/`GameEvent` (Task 3), `deriveEvents` (Task 4).
- Produces: `GameMessageBus` class with `ingest(raw: RawWsMessage, tableId: string): GameStreamItem | null`, `reset(): void`, `getLastSnapshot(): TexasHoldemStateDTO | undefined` (named export) — consumed by Task 7 (`GameStateProvider`).

**Design note (why this differs from `ui`'s `GameMessageBus`):** `ui`'s bus splits ingest into a "logical track" (fed synchronously, drives correctness) and a "render track" (paced through a queue, decorators, backpressure — purely visual smoothing). That split only exists because the render track is deliberately delayed. This plan has no pacing at all (per spec, animation choreography is Stage 2b) — so there is no queue for a "logical track" to race ahead of. `ingest()` here classifies, derives events, updates the last-seen snapshot, and returns the fully-derived item synchronously, in one call — ingest and "commit" are the same step. No `subscribe`/listener pattern, no queue, no decorators, no backpressure, no frame expansion, no introspection handle.

- [ ] **Step 1: Write the failing tests**

Create `src/bus/GameMessageBus.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/bus/GameMessageBus.test.ts`
Expected: FAIL — `Cannot find module './GameMessageBus'`.

- [ ] **Step 3: Write the implementation**

Create `src/bus/GameMessageBus.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/bus/GameMessageBus.test.ts`
Expected: PASS, all 7 tests green.

- [ ] **Step 5: Verify lint**

Run: `yarn lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/bus/GameMessageBus.ts src/bus/GameMessageBus.test.ts
git commit -m "feat: add simplified synchronous game message bus"
```

---

### Task 7: `GameStateProvider` — WebSocket connection + unified context

**Files:**
- Create: `src/context/GameStateContext.tsx`

**Interfaces:**
- Consumes: `useNetwork` (existing, `src/context/NetworkContext.tsx`, `currentNetwork.ws: string`), `getCosmosAddress` (existing, `src/utils/cosmos/storage.ts`), `createAuthPayload` (Task 5), `GameMessageBus` (Task 6), `ValidationError`/`PendingAction`/`GameEvent` (Task 3).
- Produces: `GameStateProvider` (React component), `useGameState()` hook returning `{ gameState: TexasHoldemStateDTO | undefined; gameFormat: GameFormat | undefined; gameVariant: GameVariant | undefined; gameName: string | undefined; isLoading: boolean; error: Error | null; validationError: ValidationError | null; pendingAction: PendingAction | null; latestEvents: GameEvent[]; subscribeToTable: (tableId: string) => void; unsubscribeFromTable: () => void }` — consumed by Task 8 (`Table.tsx`) and, later, Plan 2's action hooks (for `gameState`/`subscribeToTable` reads) and Plan 3's UI components.

Note: unlike `ui`'s `GameStateContext`, this has no `sendAction`/`loadHistoricalState` — action submission is Plan 2's concern (and per the spec, actions submit via the Cosmos signing-client path, not this websocket), and replay mode is out of scope for Stage 2a entirely.

- [ ] **Step 1: Create `src/context/GameStateContext.tsx`**

```tsx
import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import type { TexasHoldemStateDTO, GameFormat, GameVariant } from "@block52/poker-vm-sdk";
import { useNetwork } from "./NetworkContext";
import { getCosmosAddress } from "../utils/cosmos/storage";
import { createAuthPayload } from "../utils/cosmos/signing";
import { GameMessageBus } from "../bus/GameMessageBus";
import type { RawWsMessage } from "../bus/ingest";
import type { ValidationError, PendingAction, GameEvent } from "../bus/types";

export interface GameStateValue {
    gameState: TexasHoldemStateDTO | undefined;
    gameFormat: GameFormat | undefined;
    gameVariant: GameVariant | undefined;
    gameName: string | undefined;
    isLoading: boolean;
    error: Error | null;
    validationError: ValidationError | null;
    pendingAction: PendingAction | null;
    latestEvents: GameEvent[];
    subscribeToTable: (tableId: string) => void;
    unsubscribeFromTable: () => void;
}

const GameStateContext = createContext<GameStateValue | null>(null);

interface GameStateProviderProps {
    children: React.ReactNode;
}

export const GameStateProvider: React.FC<GameStateProviderProps> = ({ children }) => {
    const [gameState, setGameState] = useState<TexasHoldemStateDTO | undefined>(undefined);
    const [gameFormat, setGameFormat] = useState<GameFormat | undefined>(undefined);
    const [gameVariant, setGameVariant] = useState<GameVariant | undefined>(undefined);
    const [gameName, setGameName] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);
    const [validationError, setValidationError] = useState<ValidationError | null>(null);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [latestEvents, setLatestEvents] = useState<GameEvent[]>([]);

    const { currentNetwork } = useNetwork();

    const currentTableIdRef = useRef<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const hasReceivedMessageRef = useRef<boolean>(false);
    const fallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const busRef = useRef<GameMessageBus | null>(null);
    if (busRef.current === null) {
        busRef.current = new GameMessageBus();
    }

    const subscribeToTable = useCallback(
        (tableId: string) => {
            if (currentTableIdRef.current === tableId && wsRef.current?.readyState === WebSocket.OPEN) {
                return;
            }
            if (wsRef.current?.readyState === WebSocket.CONNECTING) {
                return;
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }

            setIsLoading(true);
            setError(null);
            setValidationError(null);
            currentTableIdRef.current = tableId;
            hasReceivedMessageRef.current = false;

            busRef.current?.reset();
            setLatestEvents([]);

            if (fallbackTimeoutRef.current) {
                clearTimeout(fallbackTimeoutRef.current);
                fallbackTimeoutRef.current = null;
            }

            const playerAddress = getCosmosAddress();
            if (!playerAddress) {
                setError(new Error("No Block52 wallet address found. Please connect your wallet."));
                setIsLoading(false);
                return;
            }

            if (!currentNetwork.ws) {
                console.error("[GameStateContext] Network missing WebSocket endpoint");
                setError(new Error("Network configuration missing WebSocket endpoint"));
                setIsLoading(false);
                return;
            }

            const fullWsUrl = `${currentNetwork.ws}?tableAddress=${tableId}&playerId=${playerAddress}`;
            const ws = new WebSocket(fullWsUrl);
            wsRef.current = ws;

            ws.onopen = async () => {
                const authPayload = await createAuthPayload();

                const subscriptionMessage = {
                    type: "subscribe",
                    gameId: tableId,
                    playerAddress: authPayload?.playerAddress ?? playerAddress,
                    timestamp: authPayload?.timestamp,
                    signature: authPayload?.signature,
                };

                ws.send(JSON.stringify(subscriptionMessage));
                setIsLoading(false);

                fallbackTimeoutRef.current = setTimeout(() => {
                    if (!hasReceivedMessageRef.current && currentTableIdRef.current === tableId) {
                        console.error("[GameStateContext] WebSocket server did not respond within 5 seconds");
                        setError(
                            new Error(
                                "WebSocket server not responding. The game server may be offline or not broadcasting game state. " +
                                    "Please try refreshing or contact support if the issue persists."
                            )
                        );
                        setIsLoading(false);
                    }
                }, 5000);
            };

            ws.onmessage = event => {
                let message: RawWsMessage;
                try {
                    message = JSON.parse(event.data);
                } catch (err) {
                    console.error("[GameStateContext] Failed to parse WebSocket message:", (err as Error).message);
                    setError(new Error("Error parsing WebSocket message"));
                    return;
                }

                hasReceivedMessageRef.current = true;

                const item = busRef.current?.ingest(message, tableId);
                if (!item) {
                    return;
                }

                setLatestEvents(item.events);

                switch (item.classified.kind) {
                    case "state": {
                        setGameState(item.classified.snapshot);
                        setGameFormat(item.classified.format);
                        setGameVariant(item.classified.variant);
                        setGameName(item.classified.name);
                        setPendingAction(null);
                        if (item.classified.validationError) {
                            setValidationError(item.classified.validationError);
                        } else {
                            setError(null);
                            setValidationError(null);
                        }
                        break;
                    }
                    case "validationErrorNoState": {
                        setValidationError(item.classified.validationError);
                        break;
                    }
                    case "pending": {
                        setPendingAction(item.classified.pendingAction);
                        break;
                    }
                    case "actionAccepted": {
                        break;
                    }
                    case "error": {
                        setError(item.classified.error);
                        setIsLoading(false);
                        setPendingAction(null);
                        if (item.classified.clearGameState) {
                            setGameState(undefined);
                        }
                        break;
                    }
                    default:
                        break;
                }
            };

            ws.onclose = () => {
                if (wsRef.current === ws) {
                    wsRef.current = null;
                }
            };

            ws.onerror = wsError => {
                console.error("WebSocket error:", wsError);
                setError(new Error(`WebSocket connection error for table ${tableId}`));
                setIsLoading(false);
            };
        },
        [currentNetwork]
    );

    const unsubscribeFromTable = useCallback(() => {
        if (fallbackTimeoutRef.current) {
            clearTimeout(fallbackTimeoutRef.current);
            fallbackTimeoutRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        currentTableIdRef.current = null;
        hasReceivedMessageRef.current = false;
        busRef.current?.reset();
        setLatestEvents([]);
        setGameState(undefined);
        setGameFormat(undefined);
        setGameVariant(undefined);
        setGameName(undefined);
        setIsLoading(false);
        setError(null);
        setValidationError(null);
        setPendingAction(null);
    }, []);

    useEffect(() => {
        return () => {
            if (fallbackTimeoutRef.current) {
                clearTimeout(fallbackTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    return (
        <GameStateContext.Provider
            value={{
                gameState,
                gameFormat,
                gameVariant,
                gameName,
                isLoading,
                error,
                validationError,
                pendingAction,
                latestEvents,
                subscribeToTable,
                unsubscribeFromTable,
            }}
        >
            {children}
        </GameStateContext.Provider>
    );
};

export const useGameState = (): GameStateValue => {
    const context = useContext(GameStateContext);
    if (!context) {
        throw new Error("useGameState must be used within a GameStateProvider");
    }
    return context;
};
```

- [ ] **Step 2: Verify**

Run: `yarn lint`
Expected: no new errors.

Run: `npx tsc --noEmit 2>&1 | grep "GameStateContext.tsx"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/context/GameStateContext.tsx
git commit -m "feat: add GameStateProvider with WebSocket connection lifecycle"
```

---

### Task 8: Wire into `Table.tsx` and `app.tsx` (end-to-end proof)

**Files:**
- Modify: `src/pages/table/Table.tsx`
- Modify: `src/app.tsx`

**Interfaces:**
- Consumes: `GameStateProvider`/`useGameState` (Task 7).
- Produces: nothing later tasks import — this is Plan 1's own end-to-end verification. Plan 3 replaces this temporary raw-state rendering with the real table UI; it does not need to preserve this file's exact markup.

- [ ] **Step 1: Add `GameStateProvider` to the app's provider tree**

Read `src/app.tsx` first to see the current provider nesting (established in Stage 1: `AppKitProvider` → `NetworkProvider` → `ToastProvider` → `Router`). Add `GameStateProvider` inside `NetworkProvider` (it consumes `useNetwork`) and outside/around `Router` — e.g.:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { AppKitProvider } from "./providers/AppKitProvider";
import { NetworkProvider } from "./context/NetworkContext";
import { ToastProvider } from "./context/ToastContext";
import { GameStateProvider } from "./context/GameStateContext";
import Router from "./router";

const root = createRoot(document.body);
root.render(
    <AppKitProvider>
        <NetworkProvider>
            <ToastProvider>
                <GameStateProvider>
                    <Router />
                </GameStateProvider>
            </ToastProvider>
        </NetworkProvider>
    </AppKitProvider>
);
```

(If `app.tsx`'s actual current content differs from this — e.g. different provider names or nesting order — preserve the existing structure and just add `GameStateProvider` in the same relative position: inside `NetworkProvider`, wrapping `Router`.)

- [ ] **Step 2: Replace `Table.tsx`'s placeholder with a connect/disconnect + raw-state proof**

```tsx
import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useGameState } from "../../context/GameStateContext";

const Table: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { gameState, isLoading, error, validationError, latestEvents, subscribeToTable, unsubscribeFromTable } = useGameState();

    useEffect(() => {
        if (!id) {
            return;
        }
        subscribeToTable(id);
        return () => {
            unsubscribeFromTable();
        };
    }, [id, subscribeToTable, unsubscribeFromTable]);

    return (
        <div style={{ padding: 16, fontFamily: "monospace", color: "#fff" }}>
            <h1>Table {id}</h1>
            {isLoading && <p>Connecting…</p>}
            {error && <p style={{ color: "#ef4444" }}>Error: {error.message}</p>}
            {validationError && <p style={{ color: "#f59e0b" }}>Validation: {validationError.message}</p>}
            <h2>Latest events ({latestEvents.length})</h2>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(latestEvents, null, 2)}</pre>
            <h2>Raw game state</h2>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{gameState ? JSON.stringify(gameState, null, 2) : "(no state yet)"}</pre>
        </div>
    );
};

export default Table;
```

This is deliberately temporary — a raw JSON dump, not real UI. Plan 3 replaces this entire file with the actual seating/board/action-button component tree; nothing later depends on this exact markup.

- [ ] **Step 3: Verify**

Run: `yarn lint`
Expected: no new errors.

Run: `yarn start`, then manually:
1. Ensure a Cosmos wallet exists (via `/wallet`, from earlier work).
2. Navigate to `/table/<some-table-id>` from the dashboard's table list (a real or test table ID from whatever backend `currentNetwork` points at).
3. Confirm "Connecting…" appears then clears, and either raw `gameState` JSON renders or a clear error message appears (e.g. if the table ID doesn't exist on the connected backend — that's expected/acceptable for this proof, not a bug to fix here).
4. Watch the Electron DevTools console for `[GameStateContext]`/`[GameMessageBus]` logs and confirm no uncaught exceptions.
5. Navigate away and confirm no console errors from a lingering WebSocket (the cleanup effect should close it).

- [ ] **Step 4: Commit**

```bash
git add src/pages/table/Table.tsx src/app.tsx
git commit -m "feat: wire GameStateProvider into the app and prove the table connection end to end"
```

---

## Self-Review Notes

- **Spec coverage:** WebSocket connection (Task 7), simplified logical-track-only ingest pipeline (Tasks 3/4/6), unified context — not the 5-slice split (Task 7), CSP prerequisite (Task 1). Explicitly-out-of-scope items (decorators/backpressure/pacing, frame expansion, 5-slice contexts, Replay mode, action submission, real table UI) are not present anywhere in this plan — verified by the task list containing no such files.
- **Type consistency:** `GameStreamItem`/`GameEvent`/`ValidationError`/`PendingAction` (Task 3) are the exact types `deriveEvents` (Task 4), `GameMessageBus` (Task 6), and `GameStateContext` (Task 7) import and use — no renamed/duplicated shapes across tasks.
- **New dependency:** `ethers@^6.15.0` (Task 5) — matches `ui`'s pinned version, used only for the WS-auth signature, does not touch the existing wagmi/viem Web3 wallet stack from Stage 1.
