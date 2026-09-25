# Action Transport + Legal-Action Computation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the action-submission infrastructure every player-action hook in Plan 2c will call through: a caching, retrying Cosmos signing-client layer; the chain-direct gameplay-action transport (`executeTransportAction`); the money-mover retry wrapper (`withMoneyMoverRetry`) that `joinTable`/`leaveTable` will use; and the pure legal-actions computation (`usePlayerLegalActions`) that drives which action buttons are enabled.

**Architecture:** Port four pieces from `ui` into `desktop`, adapted to desktop's existing infra rather than copied verbatim: (1) desktop-local result types (`PlayerActionResult`/`JoinTableResult`/`LeaveTableResult`/`PlayerLegalActionsResult`) since none are SDK exports; (2) `desktop`'s `getSigningClient` gains caching + a matching invalidation/retry toolkit (`clearSigningClientCache`, `isSequenceMismatchError`, `isTransportError`, `withMoneyMoverRetry`) — desktop's current version re-derives the signing client via PBKDF2 on every call, which Plan 2c's ~15 action hooks would otherwise each pay; (3) `executeTransportAction`, the funnel every gameplay action (bet/call/raise/fold/...) submits through, with its own inline sequence-mismatch retry; (4) `usePlayerLegalActions`, rebuilt around desktop's single `useGameState()` context (replacing `ui`'s split `useGameData()`/`useGameUI()`) with its core computation extracted into a pure, directly-testable function.

**Tech Stack:** React 19, TypeScript, `@block52/poker-vm-sdk`, `vitest`.

**Spec:** `docs/superpowers/specs/2026-09-24-player-actions-design.md` (the "Plan 2b" and "Two things Plan 1 didn't anticipate" sections)

## Global Constraints

- Quotes: always double quotes in `.ts`/`.tsx` (repo CLAUDE.md).
- No `any` type (repo CLAUDE.md).
- No `||`/`??` fallback for SDK values that could mask missing/error data (repo CLAUDE.md). This plan uses `??`/ternary only to normalize an *optional* SDK field's `undefined` into this codebase's local `| null` convention (e.g. `sitInMethod`), or to convert `Array.prototype.find()`'s native `undefined` into the same local `| null` convention — neither suppresses required data. Boolean `||` between two already-resolved booleans (e.g. `isSmallBlind || smallBlindPosition === seat`) is plain disjunction, not a fallback, and is unaffected by this rule.
- No behavior change to anything already merged: `src/context/GameStateContext.tsx` and `src/bus/GameMessageBus.ts` are NOT touched by this plan. This plan only adds new files plus additive changes to `src/utils/cosmos/client.ts` (existing functions `getCosmosClient`, `clearCosmosClient`, `getDefaultCosmosConfig`, `getCosmosConfigWithEndpoints`, and the type re-exports are unchanged).
- `src/utils/cosmos/client.ts` currently uses 2-space indentation (unlike this codebase's 4-space convention elsewhere, e.g. `GameStateContext.tsx`) — match the file's own existing indentation when editing it. New files created by this plan use 4-space indentation, matching `src/bus/*.ts` and `src/context/GameStateContext.tsx`.
- No test runner infrastructure beyond what's already installed (`vitest`, no DOM/`@testing-library/react`) is added by this plan — `usePlayerLegalActions`' logic is tested via a pure, exported computation function, not by rendering the hook.
- Nothing from `ui` is ported into this plan that has no live caller in our scope: `nextActionIndex` (only real caller is `ui`'s out-of-scope `submit/confirmationGate.ts`) and `withSigningClientRetry` (zero real callers in `ui`'s own action hooks) are deliberately excluded — do not add them.

---

### Task 1: Local result types

**Files:**
- Create: `src/types/index.ts`
- Create: `src/hooks/playerActions/types.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `PlayerActionResult` (`hash: string; gameId: string; action: string; amount?: string`), `JoinTableResult` (`Omit<PlayerActionResult, "action"> & { seat: number; buyInAmount: string }`), `LeaveTableResult` (`= PlayerActionResult`) from `src/types/index.ts` — consumed by Task 3 (`PlayerActionResult`) and by Plan 2c's `joinTable`/`leaveTable` hooks (not built yet). `PlayerLegalActionsResult` from `src/hooks/playerActions/types.ts` — consumed by Task 4.

- [ ] **Step 1: Create the player-action result types**

Create `src/types/index.ts`:

```ts
/**
 * Result types for player-action hooks (bet, call, raise, fold, join,
 * leave, ...). Not SDK exports — desktop-local, mirroring ui's shapes.
 */

/** Result returned from player action hooks (bet, call, raise, fold, etc.). */
export interface PlayerActionResult {
    /** Transaction hash from the blockchain */
    hash: string;
    /** The game/table ID where the action was performed */
    gameId: string;
    /** The action that was performed (e.g., "bet", "call", "raise", "fold") */
    action: string;
    /** The amount involved in the action (in micro-units as string), if applicable */
    amount?: string;
}

/**
 * Result returned from joinTable.
 * Extends PlayerActionResult with join-specific properties.
 */
export interface JoinTableResult extends Omit<PlayerActionResult, "action"> {
    /** The seat number the player joined at */
    seat: number;
    /** The buy-in amount (in micro-units as string) */
    buyInAmount: string;
}

/**
 * Result returned from leaveTable. MsgLeaveGame carries no amount — the
 * chain decides the refund from its own state — so this is a thin alias
 * over PlayerActionResult.
 */
export type LeaveTableResult = PlayerActionResult;
```

- [ ] **Step 2: Create the legal-actions result type**

Create `src/hooks/playerActions/types.ts`:

```ts
import type { LegalActionDTO, PlayerStatus } from "@block52/poker-vm-sdk";

export interface PlayerLegalActionsResult {
    legalActions: LegalActionDTO[];
    isSmallBlindPosition: boolean;
    isBigBlindPosition: boolean;
    isDealerPosition: boolean;
    isPlayerTurn: boolean;
    playerStatus: PlayerStatus | null;
    playerSeat: number | null;
    sitInMethod: string | null;
    pendingSitOut: string | null;
    foldActionIndex: number | null;
    actionTurnIndex: number;
    isPlayerInGame: boolean;
    isLoading: boolean;
    error: Error | null;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as on `main` before this change — these are new, unimported files with valid syntax, so they add no new errors.

Run: `yarn lint`
Expected: 0 errors (same baseline warning count as `main`).

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/hooks/playerActions/types.ts
git commit -m "feat: add local result types for player-action hooks"
```

---

### Task 2: Signing-client caching + retry helpers

**Files:**
- Modify: `src/utils/cosmos/client.ts`
- Test: `src/utils/cosmos/client.test.ts`

**Interfaces:**
- Consumes: nothing new (uses existing `getCosmosAddress`/`getCosmosMnemonic` from `./storage`, `getCosmosUrls` from `./urls`, `createSigningClientFromMnemonic`/`COSMOS_CONSTANTS`/`SigningCosmosClient` from `@block52/poker-vm-sdk`).
- Produces: `SigningClientResult` (`{ signingClient: SigningCosmosClient; userAddress: string }`), `getSigningClient(network): Promise<SigningClientResult>` (now cached — same signature as before, callers are unaffected), `clearSigningClientCache(): void`, `isSequenceMismatchError(err: unknown): boolean`, `isTransportError(err: unknown): boolean`, `SEQUENCE_RETRY_DELAY_MS = 1500`, `withMoneyMoverRetry<T>(network, fn: (client: SigningClientResult) => Promise<T>): Promise<T>` — all from `src/utils/cosmos/client.ts`. Consumed by Task 3 (`getSigningClient`, `isSequenceMismatchError`, `clearSigningClientCache`, `SEQUENCE_RETRY_DELAY_MS`) and by Plan 2c's `joinTable`/`leaveTable` hooks (`withMoneyMoverRetry`, not built yet).

The current `src/utils/cosmos/client.ts` on `main` ends with this `getSigningClient` (lines 145-170):

```ts
export async function getSigningClient(network: NetworkEndpoints) {
  const userAddress = getCosmosAddress();
  const mnemonic = getCosmosMnemonic();

  if (!userAddress || !mnemonic) {
    throw new Error(
      "Block52 wallet not initialized. Please create or import a Block52 wallet first.",
    );
  }

  const { rpcEndpoint, restEndpoint } = getCosmosUrls(network);

  const signingClient = await createSigningClientFromMnemonic(
    {
      rpcEndpoint,
      restEndpoint,
      chainId: COSMOS_CONSTANTS.CHAIN_ID,
      prefix: COSMOS_CONSTANTS.ADDRESS_PREFIX,
      denom: "stake",
      gasPrice: "0stake", // Gasless
    },
    mnemonic,
  );

  return { signingClient, userAddress };
}
```

- [ ] **Step 1: Write the failing tests**

Create `src/utils/cosmos/client.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NetworkEndpoints } from "../../context/NetworkContext";

const { mockCreateSigningClientFromMnemonic, mockGetCosmosAddress, mockGetCosmosMnemonic } = vi.hoisted(() => ({
    mockCreateSigningClientFromMnemonic: vi.fn(),
    mockGetCosmosAddress: vi.fn(),
    mockGetCosmosMnemonic: vi.fn(),
}));

vi.mock("@block52/poker-vm-sdk", async () => {
    const actual = await vi.importActual<typeof import("@block52/poker-vm-sdk")>("@block52/poker-vm-sdk");
    return {
        ...actual,
        createSigningClientFromMnemonic: mockCreateSigningClientFromMnemonic,
    };
});

vi.mock("./storage", () => ({
    getCosmosAddress: mockGetCosmosAddress,
    getCosmosMnemonic: mockGetCosmosMnemonic,
}));

import {
    getSigningClient,
    clearSigningClientCache,
    isSequenceMismatchError,
    isTransportError,
    withMoneyMoverRetry,
    SEQUENCE_RETRY_DELAY_MS,
} from "./client";

const NETWORK_A: NetworkEndpoints = { name: "testnet-a", rpc: "http://rpc-a", rest: "http://rest-a", grpc: "http://grpc-a", ws: "ws://ws-a" };
const NETWORK_B: NetworkEndpoints = { name: "testnet-b", rpc: "http://rpc-b", rest: "http://rest-b", grpc: "http://grpc-b", ws: "ws://ws-b" };

function fakeSigningClient(): Record<string, unknown> {
    return { performActionSync: vi.fn(), joinGame: vi.fn(), leaveGame: vi.fn() };
}

describe("getSigningClient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearSigningClientCache();
        mockGetCosmosAddress.mockReturnValue("b52addr1");
        mockGetCosmosMnemonic.mockReturnValue("test mnemonic words here");
        mockCreateSigningClientFromMnemonic.mockResolvedValue(fakeSigningClient());
    });

    it("derives the signing client only once across repeated calls in the same session", async () => {
        await getSigningClient(NETWORK_A);
        await getSigningClient(NETWORK_A);
        await getSigningClient(NETWORK_A);

        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(1);
    });

    it("dedupes concurrent callers into a single in-flight derivation", async () => {
        const [a, b] = await Promise.all([getSigningClient(NETWORK_A), getSigningClient(NETWORK_A)]);

        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(1);
        expect(a).toBe(b);
    });

    it("rebuilds when the network endpoints change", async () => {
        await getSigningClient(NETWORK_A);
        await getSigningClient(NETWORK_B);

        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
    });

    it("rebuilds when the wallet address changes (wallet swap)", async () => {
        await getSigningClient(NETWORK_A);
        mockGetCosmosAddress.mockReturnValue("b52addr2");
        await getSigningClient(NETWORK_A);

        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
    });

    it("rebuilds after clearSigningClientCache()", async () => {
        await getSigningClient(NETWORK_A);
        clearSigningClientCache();
        await getSigningClient(NETWORK_A);

        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
    });

    it("drops the cache when derivation rejects so the next call retries", async () => {
        mockCreateSigningClientFromMnemonic.mockRejectedValueOnce(new Error("connection refused"));

        await expect(getSigningClient(NETWORK_A)).rejects.toThrow("connection refused");

        mockCreateSigningClientFromMnemonic.mockResolvedValueOnce(fakeSigningClient());
        await expect(getSigningClient(NETWORK_A)).resolves.toBeDefined();
        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
    });

    it("throws if the wallet is not initialized", async () => {
        mockGetCosmosMnemonic.mockReturnValue(null);

        await expect(getSigningClient(NETWORK_A)).rejects.toThrow("Block52 wallet not initialized");
    });
});

describe("isSequenceMismatchError", () => {
    it("matches the SDK account-sequence-mismatch broadcast error", () => {
        const err = new Error(
            "Broadcasting transaction failed with code 32 (codespace: sdk). Log: account sequence mismatch, expected 510, got 509"
        );
        expect(isSequenceMismatchError(err)).toBe(true);
    });

    it("is case-insensitive and works on plain strings", () => {
        expect(isSequenceMismatchError("ACCOUNT SEQUENCE MISMATCH")).toBe(true);
    });

    it("does not match unrelated errors", () => {
        expect(isSequenceMismatchError(new Error("insufficient funds"))).toBe(false);
    });
});

describe("isTransportError", () => {
    it("matches a network-shaped error message", () => {
        expect(isTransportError(new Error("Network request failed"))).toBe(true);
    });

    it("does not match an application-level rejection", () => {
        expect(isTransportError(new Error("insufficient funds"))).toBe(false);
    });

    it("does not match a non-object value", () => {
        expect(isTransportError("plain string")).toBe(false);
    });
});

describe("withMoneyMoverRetry", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearSigningClientCache();
        mockGetCosmosAddress.mockReturnValue("b52addr1");
        mockGetCosmosMnemonic.mockReturnValue("test mnemonic words here");
        mockCreateSigningClientFromMnemonic.mockResolvedValue(fakeSigningClient());
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("passes through successful results without rebuilding the client", async () => {
        const fn = vi.fn().mockResolvedValue("0xhash");

        const result = await withMoneyMoverRetry(NETWORK_A, fn);

        expect(result).toBe("0xhash");
        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(1);
    });

    it("retries once with a fresh client after a sequence mismatch, waiting for the pending tx to commit", async () => {
        const seqErr = new Error("account sequence mismatch, expected 2, got 1");
        const fn = vi.fn().mockRejectedValueOnce(seqErr).mockResolvedValueOnce("0xretry");

        const resultPromise = withMoneyMoverRetry(NETWORK_A, fn);
        await vi.advanceTimersByTimeAsync(SEQUENCE_RETRY_DELAY_MS);
        const result = await resultPromise;

        expect(result).toBe("0xretry");
        expect(fn).toHaveBeenCalledTimes(2);
        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
    });

    it("retries once on transport errors without waiting", async () => {
        const fn = vi.fn().mockRejectedValueOnce(new Error("network request failed")).mockResolvedValueOnce("0xretry");

        const result = await withMoneyMoverRetry(NETWORK_A, fn);

        expect(result).toBe("0xretry");
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("does NOT retry unrelated application errors", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("insufficient funds"));

        await expect(withMoneyMoverRetry(NETWORK_A, fn)).rejects.toThrow("insufficient funds");
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("surfaces the error if the retry also fails (a persistently wedged sequence)", async () => {
        const seqErr = new Error("account sequence mismatch, expected 3, got 1");
        const fn = vi.fn().mockRejectedValue(seqErr);

        const resultPromise = withMoneyMoverRetry(NETWORK_A, fn).catch((e: unknown) => e);
        await vi.advanceTimersByTimeAsync(SEQUENCE_RETRY_DELAY_MS);
        const result = await resultPromise;

        expect(result).toBeInstanceOf(Error);
        expect(fn).toHaveBeenCalledTimes(2);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/cosmos/client.test.ts`
Expected: FAIL — `getSigningClient`/`clearSigningClientCache`/`isSequenceMismatchError`/`isTransportError`/`withMoneyMoverRetry`/`SEQUENCE_RETRY_DELAY_MS` do not yet match this shape (module doesn't export most of these yet).

- [ ] **Step 3: Implement the caching + retry helpers**

In `src/utils/cosmos/client.ts`, change the top import block from:

```ts
import {
  CosmosClient,
  createSigningClientFromMnemonic,
  getDefaultCosmosConfig as getDefaultCosmosConfigSDK,
  COSMOS_CONSTANTS,
} from "@block52/poker-vm-sdk";
```

to:

```ts
import {
  CosmosClient,
  createSigningClientFromMnemonic,
  getDefaultCosmosConfig as getDefaultCosmosConfigSDK,
  COSMOS_CONSTANTS,
  SigningCosmosClient,
} from "@block52/poker-vm-sdk";
```

Then replace the existing `getSigningClient` function (the block quoted above, at the end of the file) with:

```ts
export interface SigningClientResult {
  signingClient: SigningCosmosClient;
  userAddress: string;
}

let signingClientCache: {
  key: string;
  promise: Promise<SigningClientResult>;
} | null = null;

/**
 * Get (or build and cache) the signing client for the current wallet + network.
 *
 * Returns the same Promise across concurrent calls within a session, so the
 * expensive PBKDF2 derivation runs once per (wallet, network) pair.
 *
 * @throws Error if Cosmos wallet is not initialized (no mnemonic or address)
 */
export async function getSigningClient(network: NetworkEndpoints): Promise<SigningClientResult> {
  const userAddress = getCosmosAddress();
  const mnemonic = getCosmosMnemonic();

  if (!userAddress || !mnemonic) {
    throw new Error(
      "Block52 wallet not initialized. Please create or import a Block52 wallet first.",
    );
  }

  const { rpcEndpoint, restEndpoint } = getCosmosUrls(network);
  const key = `${userAddress}|${rpcEndpoint}|${restEndpoint}`;

  if (signingClientCache?.key === key) {
    return signingClientCache.promise;
  }

  const promise = createSigningClientFromMnemonic(
    {
      rpcEndpoint,
      restEndpoint,
      chainId: COSMOS_CONSTANTS.CHAIN_ID,
      prefix: COSMOS_CONSTANTS.ADDRESS_PREFIX,
      denom: "stake",
      gasPrice: "0stake", // Gasless
    },
    mnemonic,
  ).then((signingClient) => ({ signingClient, userAddress }));

  // If construction rejects, drop the cache so the next call retries
  // instead of returning a permanently-failed promise.
  promise.catch(() => {
    if (signingClientCache?.promise === promise) {
      signingClientCache = null;
    }
  });

  signingClientCache = { key, promise };
  return promise;
}

/**
 * Clear the cached signing client.
 *
 * Call on: logout, wallet import/change, network switch, and from
 * withMoneyMoverRetry's error-recovery path below.
 */
export function clearSigningClientCache(): void {
  const previous = signingClientCache;
  signingClientCache = null;
  // Best-effort cleanup — disconnect if the SDK exposes it.
  previous?.promise
    .then((c) => (c.signingClient as { disconnect?: () => void }).disconnect?.())
    .catch(() => {
      /* already-rejected promise, nothing to disconnect */
    });
}

/**
 * Does this error look like a Cosmos account-sequence mismatch (SDK code 32,
 * "account sequence mismatch, expected N, got M")?
 *
 * Every tx from an account carries an account sequence. When a prior tx is
 * still pending in the mempool (accepted by CheckTx but not yet committed),
 * a fresh getSequence query still returns the pre-increment value, so the
 * next tx signs a sequence that collides and the chain rejects it with this
 * error. Repeatable while the pending tx sits uncommitted.
 */
export function isSequenceMismatchError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /account sequence mismatch/i.test(message);
}

/**
 * Heuristic: does this error look like a dead RPC connection rather than a
 * chain-level rejection? Errs on the side of NOT retrying — a false
 * negative just means we don't retry a recoverable failure; a false
 * positive could double-submit a tx that was actually rejected.
 */
export function isTransportError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const message = (err as { message?: unknown }).message;
  if (typeof message !== "string") return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("socket") ||
    lower.includes("econnreset") ||
    lower.includes("econnrefused") ||
    lower.includes("etimedout") ||
    lower.includes("disconnected") ||
    lower.includes("connection")
  );
}

export const SEQUENCE_RETRY_DELAY_MS = 1500;

/**
 * Run a chain-direct MONEY-MOVER (join / leave / top-up) with recovery for
 * the two ways a cached client + ordered sequence can transiently fail:
 *
 *   - Transport error (stale RPC socket): clear the cache, reconnect, retry.
 *   - Sequence mismatch (a prior money-mover still pending in the mempool):
 *     clear the cache so the retry reconnects and re-queries the sequence,
 *     wait a beat for the pending tx to commit and bump the on-chain
 *     sequence, then retry.
 *
 * A single retry after a short delay clears the common "pending tx not yet
 * committed" case. This does NOT loop — a persistently wedged account
 * surfaces the error so it isn't silently masked.
 *
 * Gameplay actions must NOT use this — they're unordered and never carry a
 * sequence, so they can't hit a sequence mismatch. See executeTransportAction
 * in transportAction.ts for the gameplay-action retry path instead.
 */
export async function withMoneyMoverRetry<T>(
  network: NetworkEndpoints,
  fn: (client: SigningClientResult) => Promise<T>,
): Promise<T> {
  const client = await getSigningClient(network);
  try {
    return await fn(client);
  } catch (err) {
    const sequenceMismatch = isSequenceMismatchError(err);
    if (!isTransportError(err) && !sequenceMismatch) {
      throw err;
    }
    // Force a fresh client so the retry re-queries the account sequence.
    clearSigningClientCache();
    if (sequenceMismatch) {
      // Give the pending money-mover a chance to commit so the re-query
      // returns the advanced sequence instead of the same stale value.
      await new Promise((resolve) => setTimeout(resolve, SEQUENCE_RETRY_DELAY_MS));
    }
    const fresh = await getSigningClient(network);
    return fn(fresh);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/cosmos/client.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Verify no regressions**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as before this task (no new type errors — `getCosmosClient` still uses `getDefaultCosmosConfigSDK`/`CosmosClient` unchanged; only `getSigningClient`'s body and new exports were touched).

Run: `yarn lint`
Expected: 0 errors, same baseline warning count.

Run: `npx vitest run`
Expected: all existing + new tests pass (34 existing + this task's new tests).

- [ ] **Step 6: Commit**

```bash
git add src/utils/cosmos/client.ts src/utils/cosmos/client.test.ts
git commit -m "feat: cache signing client and add money-mover retry helpers"
```

---

### Task 3: Gameplay-action transport (`executeTransportAction`)

**Files:**
- Create: `src/hooks/playerActions/transportAction.ts`
- Test: `src/hooks/playerActions/transportAction.test.ts`

**Interfaces:**
- Consumes: `getSigningClient`, `isSequenceMismatchError`, `clearSigningClientCache`, `SEQUENCE_RETRY_DELAY_MS` from `src/utils/cosmos/client.ts` (Task 2); `PlayerActionResult` from `src/types/index.ts` (Task 1).
- Produces: `executeTransportAction(tableId: string, action: string, amount: bigint, network: NetworkEndpoints, data?: string): Promise<PlayerActionResult>`, `isStaleIndexError(err: unknown): boolean`, `STALE_INDEX_MESSAGE: string` from `src/hooks/playerActions/transportAction.ts` — consumed by Plan 2c's manual gameplay-action hooks (bet/call/raise/fold/check/sitIn/sitOut/muck/show, not built yet).

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/playerActions/transportAction.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NetworkEndpoints } from "../../context/NetworkContext";

const { mockGetSigningClient, mockClearSigningClientCache } = vi.hoisted(() => ({
    mockGetSigningClient: vi.fn(),
    mockClearSigningClientCache: vi.fn(),
}));

vi.mock("../../utils/cosmos/client", () => ({
    getSigningClient: mockGetSigningClient,
    clearSigningClientCache: mockClearSigningClientCache,
    isSequenceMismatchError: (err: unknown) =>
        /account sequence mismatch/i.test(err instanceof Error ? err.message : String(err ?? "")),
    SEQUENCE_RETRY_DELAY_MS: 0,
}));

import { executeTransportAction, isStaleIndexError, STALE_INDEX_MESSAGE } from "./transportAction";

const FAKE_NETWORK = { name: "testnet", rpc: "http://x", rest: "http://y", grpc: "http://z", ws: "ws://w" } as NetworkEndpoints;

function mockSigningClient(performActionSync: ReturnType<typeof vi.fn>): void {
    mockGetSigningClient.mockResolvedValue({ signingClient: { performActionSync }, userAddress: "b52test" });
}

describe("isStaleIndexError", () => {
    it("matches the chain's stale action-index rejection", () => {
        expect(isStaleIndexError(new Error("Invalid action index"))).toBe(true);
    });

    it("does not match unrelated errors", () => {
        expect(isStaleIndexError(new Error("insufficient funds"))).toBe(false);
    });
});

describe("executeTransportAction — stale-index rewrite", () => {
    beforeEach(() => vi.clearAllMocks());

    it("rewrites the chain's raw 'Invalid action index' into the retryable prompt", async () => {
        mockSigningClient(vi.fn().mockRejectedValue(new Error("Invalid action index")));

        await expect(executeTransportAction("game-1", "call", 0n, FAKE_NETWORK)).rejects.toThrow(STALE_INDEX_MESSAGE);
    });

    it("propagates every other chain error unchanged", async () => {
        mockSigningClient(vi.fn().mockRejectedValue(new Error("insufficient funds")));

        await expect(executeTransportAction("game-1", "call", 0n, FAKE_NETWORK)).rejects.toThrow("insufficient funds");
    });

    it("returns the tx result on success", async () => {
        mockSigningClient(vi.fn().mockResolvedValue("0xabc"));

        const result = await executeTransportAction("game-1", "bet", 100n, FAKE_NETWORK);

        expect(result).toEqual({ hash: "0xabc", gameId: "game-1", action: "bet", amount: "100" });
    });
});

describe("executeTransportAction — sequence-mismatch recovery", () => {
    beforeEach(() => vi.clearAllMocks());

    const SEQ_ERR = new Error(
        "Broadcasting transaction failed with code 32 (codespace: sdk). Log: account sequence mismatch, expected 510, got 509: incorrect account sequence"
    );

    it("clears the client cache and retries once, succeeding on the retry", async () => {
        const performActionSync = vi.fn().mockRejectedValueOnce(SEQ_ERR).mockResolvedValueOnce("0xretry");
        mockSigningClient(performActionSync);

        const result = await executeTransportAction("game-1", "sit-out", 0n, FAKE_NETWORK, "method=next-hand");

        expect(result).toEqual({ hash: "0xretry", gameId: "game-1", action: "sit-out", amount: "0" });
        expect(performActionSync).toHaveBeenCalledTimes(2);
        expect(mockClearSigningClientCache).toHaveBeenCalledTimes(1);
    });

    it("surfaces the error if the sequence mismatch persists after the retry", async () => {
        const performActionSync = vi.fn().mockRejectedValue(SEQ_ERR);
        mockSigningClient(performActionSync);

        await expect(
            executeTransportAction("game-1", "sit-out", 0n, FAKE_NETWORK, "method=next-hand")
        ).rejects.toThrow(/account sequence mismatch/);
        expect(performActionSync).toHaveBeenCalledTimes(2);
    });

    it("does not retry a non-sequence error", async () => {
        const performActionSync = vi.fn().mockRejectedValue(new Error("insufficient funds"));
        mockSigningClient(performActionSync);

        await expect(executeTransportAction("game-1", "sit-out", 0n, FAKE_NETWORK)).rejects.toThrow("insufficient funds");
        expect(performActionSync).toHaveBeenCalledTimes(1);
        expect(mockClearSigningClientCache).not.toHaveBeenCalled();
    });

    it("rewrites a stale-index error surfaced on the retry", async () => {
        const performActionSync = vi
            .fn()
            .mockRejectedValueOnce(SEQ_ERR)
            .mockRejectedValueOnce(new Error("Invalid action index"));
        mockSigningClient(performActionSync);

        await expect(
            executeTransportAction("game-1", "sit-out", 0n, FAKE_NETWORK, "method=next-hand")
        ).rejects.toThrow(STALE_INDEX_MESSAGE);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/hooks/playerActions/transportAction.test.ts`
Expected: FAIL — `./transportAction` does not exist yet.

- [ ] **Step 3: Implement `transportAction.ts`**

Create `src/hooks/playerActions/transportAction.ts`:

```ts
/**
 * Action executor — the single funnel every per-action helper (callHand,
 * foldHand, ...) routes through.
 *
 * Actions submit chain-direct via the SDK's performActionSync. The action
 * index is assigned by the chain at execution from committed state, so the
 * client never supplies one.
 */
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import {
    getSigningClient,
    isSequenceMismatchError,
    clearSigningClientCache,
    SEQUENCE_RETRY_DELAY_MS,
} from "../../utils/cosmos/client";

/**
 * The engine keys replay protection on the action index and rejects a
 * mismatch with "Invalid action index." This happens when ANOTHER player
 * acts between our state snapshot and our submit — a mid-hand join / sit-in
 * consumes indices — leaving ours stale.
 */
export function isStaleIndexError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    return /invalid action index/i.test(msg);
}

// User-facing, retryable message for the stale-index case. Deliberately NOT
// auto-retried (that can mask real problems / double-fire); instead this
// surfaces a clear prompt so the user re-submits, which recomputes the
// index from the state that has since advanced.
export const STALE_INDEX_MESSAGE = "Your turn advanced while you were acting — please try again.";

async function broadcastAction(
    tableId: string,
    action: string,
    amount: bigint,
    network: NetworkEndpoints,
    data?: string
): Promise<PlayerActionResult> {
    const { signingClient } = await getSigningClient(network);
    const transactionHash = await signingClient.performActionSync(tableId, action, amount, data);
    return {
        hash: transactionHash,
        gameId: tableId,
        action,
        amount: amount.toString(),
    };
}

export async function executeTransportAction(
    tableId: string,
    action: string,
    amount: bigint,
    network: NetworkEndpoints,
    data?: string
): Promise<PlayerActionResult> {
    try {
        return await broadcastAction(tableId, action, amount, network, data);
    } catch (err) {
        // Account sequence mismatch (Cosmos code 32): a prior tx from this
        // account is still pending in the mempool, so getSequence returned a
        // stale (already-consumed) value and this action signed a colliding
        // sequence. code-32 is a CheckTx rejection — the action was NOT
        // applied — so clear the cached client, wait a beat for the pending
        // tx to commit and bump the on-chain sequence, then retry once.
        if (isSequenceMismatchError(err)) {
            clearSigningClientCache();
            await new Promise(resolve => setTimeout(resolve, SEQUENCE_RETRY_DELAY_MS));
            try {
                return await broadcastAction(tableId, action, amount, network, data);
            } catch (retryErr) {
                if (isStaleIndexError(retryErr)) {
                    throw new Error(STALE_INDEX_MESSAGE);
                }
                throw retryErr;
            }
        }
        // Rewrite the raw "Invalid action index" into a clear, retryable
        // prompt. A rejected action was NOT applied, so re-submitting is
        // safe. Every other error propagates unchanged.
        if (isStaleIndexError(err)) {
            throw new Error(STALE_INDEX_MESSAGE);
        }
        throw err;
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/hooks/playerActions/transportAction.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Verify no regressions**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as after Task 2.

Run: `yarn lint`
Expected: 0 errors, same baseline warning count.

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/playerActions/transportAction.ts src/hooks/playerActions/transportAction.test.ts
git commit -m "feat: add executeTransportAction gameplay-action transport"
```

---

### Task 4: Legal-actions computation (`usePlayerLegalActions`)

**Files:**
- Create: `src/hooks/playerActions/usePlayerLegalActions.ts`
- Test: `src/hooks/playerActions/usePlayerLegalActions.test.ts`

**Interfaces:**
- Consumes: `useGameState` (`gameState`, `isLoading`, `error` fields) from `src/context/GameStateContext.tsx` (merged, Plan 2a); `getCosmosAddress` from `src/utils/cosmos/storage.ts` (existing); `hasElements` from `src/utils/guards.ts` (existing); `PlayerLegalActionsResult` from `src/hooks/playerActions/types.ts` (Task 1).
- Produces: `computeLegalActionsResult(gameState, userAddress, isLoading, error): PlayerLegalActionsResult` (pure, exported for direct testing) and `usePlayerLegalActions(): PlayerLegalActionsResult` (the hook) from `src/hooks/playerActions/usePlayerLegalActions.ts` — consumed by every Plan 2c action hook (not built yet) and, eventually, `Table.tsx`'s debug-page action buttons.

The pure computation is extracted into its own exported function specifically so it's testable without a DOM or `@testing-library/react` (neither is installed in this repo) — `computeLegalActionsResult` takes plain values and returns a plain value; `usePlayerLegalActions` is a thin `useState`+`useMemo` wrapper around it.

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/playerActions/usePlayerLegalActions.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/hooks/playerActions/usePlayerLegalActions.test.ts`
Expected: FAIL — `./usePlayerLegalActions` does not exist yet.

- [ ] **Step 3: Implement `usePlayerLegalActions.ts`**

Create `src/hooks/playerActions/usePlayerLegalActions.ts`:

```tsx
import { useMemo, useState } from "react";
import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { LegalActionDTO, PlayerDTO, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { useGameState } from "../../context/GameStateContext";
import { getCosmosAddress } from "../../utils/cosmos/storage";
import { hasElements } from "../../utils/guards";
import type { PlayerLegalActionsResult } from "./types";

/**
 * Pure computation: derive the current player's legal actions and table
 * position from a game-state snapshot. Extracted from the hook so it's
 * directly testable without React (no DOM/testing-library dependency).
 */
export function computeLegalActionsResult(
    gameState: TexasHoldemStateDTO | undefined,
    userAddress: string | null,
    isLoading: boolean,
    error: Error | null
): PlayerLegalActionsResult {
    const defaultReturn: PlayerLegalActionsResult = {
        legalActions: [],
        isSmallBlindPosition: false,
        isBigBlindPosition: false,
        isDealerPosition: false,
        isPlayerTurn: false,
        playerStatus: null,
        playerSeat: null,
        sitInMethod: null,
        pendingSitOut: null,
        isLoading,
        error,
        foldActionIndex: null,
        actionTurnIndex: 0,
        isPlayerInGame: false,
    };

    if (isLoading || error || !gameState || !userAddress) {
        return defaultReturn;
    }

    let currentPlayer: PlayerDTO | null = null;
    if (hasElements(gameState.players)) {
        currentPlayer = gameState.players.find(player => player.address.toLowerCase() === userAddress) ?? null;
    }

    if (!currentPlayer) {
        return defaultReturn;
    }

    const isPlayerTurn = gameState.nextToAct === currentPlayer.seat;

    let foldActionIndex: number | null = null;
    const foldAction = currentPlayer.legalActions.find((action: LegalActionDTO) => action.action === PlayerActionType.FOLD);
    if (foldAction) {
        foldActionIndex = foldAction.index;
    }

    const actionTurnIndex = hasElements(currentPlayer.legalActions) ? currentPlayer.legalActions[0].index : 0;

    return {
        legalActions: currentPlayer.legalActions,
        isSmallBlindPosition: currentPlayer.isSmallBlind || gameState.smallBlindPosition === currentPlayer.seat,
        isBigBlindPosition: currentPlayer.isBigBlind || gameState.bigBlindPosition === currentPlayer.seat,
        isDealerPosition: currentPlayer.isDealer || gameState.dealer === currentPlayer.seat,
        isPlayerTurn,
        // status/seat are required (non-optional) on PlayerDTO once
        // currentPlayer is resolved — no fallback needed here.
        playerStatus: currentPlayer.status,
        playerSeat: currentPlayer.seat,
        sitInMethod: currentPlayer.sitInMethod === undefined ? null : currentPlayer.sitInMethod,
        pendingSitOut: currentPlayer.pendingSitOut === undefined ? null : currentPlayer.pendingSitOut,
        isLoading: false,
        error: null,
        foldActionIndex,
        actionTurnIndex,
        isPlayerInGame: true,
    };
}

/**
 * Computes the current player's legal actions and table position from the
 * live game-state snapshot. Table identification and subscription are
 * handled by GameStateContext — components call subscribeToTable(tableId)
 * separately; this hook only reads the resulting state.
 */
export function usePlayerLegalActions(): PlayerLegalActionsResult {
    // Wallet address is stable for the session — read once via useState's
    // initializer so a synchronous read doesn't trigger an extra render.
    const [userAddress] = useState<string | null>(() => {
        const address = getCosmosAddress();
        return address ? address.toLowerCase() : null;
    });

    const { gameState, isLoading, error } = useGameState();

    return useMemo(
        () => computeLegalActionsResult(gameState, userAddress, isLoading, error),
        [gameState, userAddress, isLoading, error]
    );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/hooks/playerActions/usePlayerLegalActions.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Verify no regressions**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as after Task 3.

Run: `yarn lint`
Expected: 0 errors, same baseline warning count.

Run: `npx vitest run`
Expected: all tests pass (Task 2's + Task 3's + Task 4's new tests, plus the pre-existing 34).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/playerActions/usePlayerLegalActions.ts src/hooks/playerActions/usePlayerLegalActions.test.ts
git commit -m "feat: add usePlayerLegalActions computation"
```

---

## Self-Review Notes

- **Spec coverage:** the spec's "Plan 2b" section lists three deliverables — desktop-local result types, `executeTransportAction` (with `usePlayerLegalActions` alongside it), and the join/leave retry wrapper distinction. All three are covered: Task 1 (types), Task 2 (`withMoneyMoverRetry` — the retry wrapper `join`/`leave` will use, kept separate from `executeTransportAction`'s own inline retry per the spec's explicit instruction not to flatten the two paths), Task 3 (`executeTransportAction`), Task 4 (`usePlayerLegalActions`).
- **Type consistency:** `PlayerActionResult` (Task 1) is the exact return type of `executeTransportAction` (Task 3) via `broadcastAction`'s return shape — verified field-for-field. `SigningClientResult` (Task 2) is the exact parameter type `withMoneyMoverRetry`'s callback receives and what `getSigningClient` resolves to, matching Task 3's destructuring (`const { signingClient } = await getSigningClient(network)`). `PlayerLegalActionsResult` (Task 1) is the exact return type of both `computeLegalActionsResult` and `usePlayerLegalActions` (Task 4).
- **No regression:** Task 2 changes `getSigningClient`'s implementation but not its call signature (`(network: NetworkEndpoints) => Promise<{ signingClient, userAddress }>`) — no existing caller elsewhere in `desktop` needs updating. `GameStateContext.tsx`/`GameMessageBus.ts` are untouched by every task in this plan.
- **Deliberately excluded (see Global Constraints):** `nextActionIndex`, `withSigningClientRetry`, and `ui`'s module-level `latestGameState` mirror (superseded by Plan 2a's `getLatestSnapshot()`) — none are ported, since none have a live caller in this plan's or Plan 2c's stated scope.
