# Action Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 11 manual player-action hooks (bet/call/check/raise/fold/muck/show/sit-in/sit-in-and-wait/sit-out/join/leave) and 3 auto-only hooks (auto-deal, auto-post-blinds, auto-new-hand) that make a poker hand actually playable, and wire one temporary button per action into `Table.tsx`'s existing debug page so the whole flow can be exercised manually end to end.

**Architecture:** Every manual in-hand/gameplay action (bet/call/check/raise/fold/muck/show/sit-in/sit-in-and-wait/sit-out/post-blinds/deal/new-hand) is a thin one-line wrapper around Plan 2b's `executeTransportAction`. `joinTable`/`leaveTable` go through Plan 2b's separate `withMoneyMoverRetry` path instead, per the spec's explicit money-mover-vs-gameplay distinction. `joinTable` additionally needs the current snapshot to resolve a real empty seat — supplied via an explicit `getLatestSnapshot` parameter (dependency injection) rather than reaching into a global, since Plan 2a deliberately exposed `useGameState().getLatestSnapshot()` for exactly this purpose. The three auto-only hooks (`useAutoDeal`, `useAutoPostBlinds`, `useAutoNewHand`) are ref-guarded effects that fire a manual hook automatically once per "opportunity," gated on caller-supplied legal-action booleans (from Plan 2b's `usePlayerLegalActions`) — `useAutoNewHand` additionally reads `getLatestSnapshot()`/`latestEvents` directly since dealing a new hand is a submission decision that must never read paced/stale state.

**Tech Stack:** React 19, TypeScript, `@block52/poker-vm-sdk`, `vitest`.

**Spec:** `docs/superpowers/specs/2026-09-24-player-actions-design.md` (the "Plan 2c" section)

## Global Constraints

- Quotes: always double quotes in `.ts`/`.tsx` (repo CLAUDE.md).
- No `any` type (repo CLAUDE.md).
- No `||`/`??` fallback for SDK values that could mask missing/error data (repo CLAUDE.md). Two patterns in this plan are compliant, not violations, matching the precedent Plan 2b already established: `enabled ?? true` in the auto-hooks defaults a local UI on/off toggle (not SDK data) when the caller omits it; `gameState ? BigInt(gameState.gameOptions.smallBlind) : 0n` in Task 7 is an explicit ternary (not `??`/`||`) that only produces `0n` when `gameState` itself doesn't exist yet, at which point the legal-action booleans gating the auto-hook are already `false`, so the `0n` is never actually acted on.
- No behavior change to anything already merged: `src/context/GameStateContext.tsx`, `src/bus/GameMessageBus.ts`, `src/utils/cosmos/client.ts`, `src/hooks/playerActions/transportAction.ts`, and `src/hooks/playerActions/usePlayerLegalActions.ts` are NOT touched by this plan (Plans 2a/2b). This plan only adds new files, adds to `src/utils/currency.ts` and `src/hooks/playerActions/types.ts`, and rewrites `src/pages/table/Table.tsx`.
- Deliberately excluded from this port (all already decided in Plan 2a/2b or this plan's own research — do not resurrect): `ui`'s `nextActionIndex`, `withSigningClientRetry`, and module-level `latestGameState`/`setLatestGameState`/`getLatestGameState`/`subscribeLatestGameState` mirror (superseded by `useGameState().getLatestSnapshot()`); `ui`'s `debugLog`/`window.debugLogs` dev tooling; `ui`'s URL-query-param auto-enable layer (`getAutoDealEnabled()`/`getAutoPostBlindsEnabled()`/`getAutoNewHandEnabled()` from `utils/urlParams.ts`, which desktop does not have); `sitIn`'s `method`/`SitInMethod` parameter (next-bb is a dead path per the spec, only post-now is ported, hardcoded); `sitOut.ts`'s re-exports of `SIT_OUT_METHOD_NEXT_BB`/`SitOutMethod` (nothing in this plan's scope consumes them — import directly from the SDK wherever needed instead).
- No test runner infrastructure beyond what's already installed (`vitest`, no DOM/`@testing-library/react`) is added by this plan.
- No automated tests for the individual thin action-hook wrappers or the three auto-trigger hooks (spec's explicit instruction: "ref-guarded effect timing, not meaningfully unit-testable in isolation"), or for `src/utils/entropy.ts` (a two-line crypto wrapper, not meaningfully testable without excessive mocking), or for `Table.tsx` (a page-level component; this codebase has no precedent of testing those). The one deliberate exception is `resolveJoinSeat` (Task 4) — a pure, extractable function with real business logic, tested directly, the same justified TDD-candidate reasoning the spec already applied to Plan 2b's `computeLegalActionsResult`.

---

### Task 1: `parseUsdcToMicro` currency utility

**Files:**
- Modify: `src/utils/currency.ts`
- Test: `src/utils/currency.test.ts` (new — the existing file has no test yet)

**Interfaces:**
- Consumes: `COSMOS_CONSTANTS` from `@block52/poker-vm-sdk` (already re-exported from `src/utils/cosmos/client.ts`, but this task imports it directly from the SDK to keep `currency.ts` dependency-light).
- Produces: `parseUsdcToMicro(value: string): bigint` — consumed by Task 4's `joinTable`.

The current `src/utils/currency.ts` is:

```ts
import { BigUnit } from "bigunit";

export const convertAmountToBigInt = (amount: string, decimals: number): bigint => {
    if (!decimals || !amount || !+amount) return BigInt(0);
    return BigUnit.from(+amount, decimals).toBigInt();
};
```

Leave `convertAmountToBigInt` completely unchanged — it has other callers outside this plan's scope (`WithdrawModal.tsx`, `Dashboard.tsx`, `TableList.tsx`) that are not part of Plan 2c.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/currency.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseUsdcToMicro } from "./currency";

describe("parseUsdcToMicro", () => {
    it("parses a whole-dollar amount", () => {
        expect(parseUsdcToMicro("5")).toBe(5000000n);
    });

    it("parses a decimal amount exactly, with no float rounding error", () => {
        expect(parseUsdcToMicro("2.01")).toBe(2010000n);
    });

    it("parses an amount with fewer than 6 decimal places", () => {
        expect(parseUsdcToMicro("0.5")).toBe(500000n);
    });

    it("parses an amount with exactly 6 decimal places", () => {
        expect(parseUsdcToMicro("1.234567")).toBe(1234567n);
    });

    it("parses zero", () => {
        expect(parseUsdcToMicro("0")).toBe(0n);
    });

    it("tolerates a leading plus sign", () => {
        expect(parseUsdcToMicro("+3.5")).toBe(3500000n);
    });

    it("throws on an empty string", () => {
        expect(() => parseUsdcToMicro("")).toThrow("parseUsdcToMicro: amount is empty");
    });

    it("throws on a whitespace-only string", () => {
        expect(() => parseUsdcToMicro("   ")).toThrow("parseUsdcToMicro: amount is empty");
    });

    it("throws on a negative amount", () => {
        expect(() => parseUsdcToMicro("-1.5")).toThrow("amount cannot be negative");
    });

    it("throws on a non-numeric string", () => {
        expect(() => parseUsdcToMicro("abc")).toThrow("is not a valid decimal amount");
    });

    it("throws on a string with a currency symbol", () => {
        expect(() => parseUsdcToMicro("$5")).toThrow("is not a valid decimal amount");
    });

    it("throws on more than 6 decimal places", () => {
        expect(() => parseUsdcToMicro("1.2345678")).toThrow("has more than 6 decimal places");
    });

    it("throws on a bare decimal point", () => {
        expect(() => parseUsdcToMicro(".")).toThrow("is not a valid decimal amount");
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/currency.test.ts`
Expected: FAIL — `parseUsdcToMicro` is not exported from `./currency` yet.

- [ ] **Step 3: Implement `parseUsdcToMicro`**

Add to `src/utils/currency.ts` (keep the existing `import` and `convertAmountToBigInt` untouched, add below them):

```ts
import { COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";

/**
 * Parse a decimal USDC string to micro-units, exactly.
 *
 * Prefer this over float-based conversion wherever the amount originates as
 * text — user input, form state, an API field. It never constructs a float,
 * so there is no precision to lose: the digits are moved and the result is
 * built from them. `2.01` is not representable in binary; the nearest double
 * times 10^6 is 2009999.9999999998, and flooring that yields 2009999 instead
 * of 2010000 — converting to bigint afterwards is too late.
 *
 * @param value Decimal USDC as text, e.g. "2.01". Up to 6 decimal places.
 * @returns Amount in micro-units, e.g. 2010000n
 * @throws If the value is not a plain non-negative decimal, or carries more
 *         precision than USDC has. It refuses rather than truncating, because
 *         silently dropping a digit is silently taking money.
 */
export function parseUsdcToMicro(value: string): bigint {
    const text = (value ?? "").trim().replace(/^\+/, "");
    if (text === "") {
        throw new Error("parseUsdcToMicro: amount is empty");
    }
    if (text.startsWith("-")) {
        throw new Error(`parseUsdcToMicro: amount cannot be negative (got "${value}")`);
    }
    // Deliberately strict: no exponents, no thousands separators, no currency
    // symbols. Callers should validate and normalise their own input rather
    // than have this quietly reinterpret it.
    if (!/^\d*\.?\d*$/.test(text) || text === ".") {
        throw new Error(`parseUsdcToMicro: "${value}" is not a valid decimal amount`);
    }

    const [whole = "", fraction = ""] = text.split(".");
    if (fraction.length > COSMOS_CONSTANTS.USDC_DECIMALS) {
        throw new Error(
            `parseUsdcToMicro: "${value}" has more than ${COSMOS_CONSTANTS.USDC_DECIMALS} decimal places, which USDC cannot represent`
        );
    }

    // Right-pad the fraction to exactly 6 digits and concatenate: no arithmetic
    // on anything that could round.
    return BigInt(`${whole || "0"}${fraction.padEnd(COSMOS_CONSTANTS.USDC_DECIMALS, "0")}`);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/currency.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Verify no regressions**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as on `main` before this change (62 lines).

Run: `npx eslint --ext .ts,.tsx src` from the repo/worktree root (scoped to `src` — do NOT run bare `yarn lint`/`eslint .` from a location where a sibling `.worktrees/` directory exists, which double-counts every file; scoping to `src` avoids this entirely).
Expected: exactly 26 warnings, 0 errors (the confirmed true baseline).

Run: `npx vitest run`
Expected: all existing tests plus this task's new tests pass (75 pre-existing + 13 new).

- [ ] **Step 6: Commit**

```bash
git add src/utils/currency.ts src/utils/currency.test.ts
git commit -m "feat: add parseUsdcToMicro currency utility"
```

---

### Task 2: Simple manual action hooks

**Files:**
- Create: `src/hooks/playerActions/betHand.ts`
- Create: `src/hooks/playerActions/callHand.ts`
- Create: `src/hooks/playerActions/checkHand.ts`
- Create: `src/hooks/playerActions/raiseHand.ts`
- Create: `src/hooks/playerActions/foldHand.ts`
- Create: `src/hooks/playerActions/muckCards.ts`
- Create: `src/hooks/playerActions/showCards.ts`

**Interfaces:**
- Consumes: `executeTransportAction` from `./transportAction` (Plan 2b, already merged); `PlayerActionResult` from `../../types` (Plan 2b, already merged); `PlayerActionType` from `@block52/poker-vm-sdk`.
- Produces: `betHand`, `callHand`, `checkHand`, `raiseHand`, `foldHand`, `muckCards`, `showCards` — each `(tableId: string, ...args, network: NetworkEndpoints) => Promise<PlayerActionResult>` — consumed by Task 7 (`Table.tsx`).

No test for this task (see Global Constraints).

- [ ] **Step 1: Create `betHand.ts`**

```ts
import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Bet in a poker game.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param amount - The amount to bet in micro-units as bigint (10^6 precision)
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function betHand(tableId: string, amount: bigint, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, PlayerActionType.BET, amount, network);
}
```

- [ ] **Step 2: Create `callHand.ts`**

```ts
import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Call in a poker game.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param amount - The amount to call in micro-units as bigint (10^6 precision)
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function callHand(tableId: string, amount: bigint, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, PlayerActionType.CALL, amount, network);
}
```

- [ ] **Step 3: Create `checkHand.ts`**

```ts
import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Check (pass) in a poker game.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function checkHand(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, PlayerActionType.CHECK, 0n, network);
}
```

- [ ] **Step 4: Create `raiseHand.ts`**

```ts
import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Raise in a poker game.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param amount - The amount to raise in micro-units as bigint (10^6 precision)
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function raiseHand(tableId: string, amount: bigint, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, PlayerActionType.RAISE, amount, network);
}
```

- [ ] **Step 5: Create `foldHand.ts`**

```ts
import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Fold in a poker game.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function foldHand(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, PlayerActionType.FOLD, 0n, network);
}
```

- [ ] **Step 6: Create `muckCards.ts`**

```ts
import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Muck cards in a poker game.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function muckCards(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, PlayerActionType.MUCK, 0n, network);
}
```

- [ ] **Step 7: Create `showCards.ts`**

```ts
import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Show cards in a poker game.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function showCards(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, PlayerActionType.SHOW, 0n, network);
}
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as after Task 1 (62 lines).

Run: `npx eslint --ext .ts,.tsx src` (scoped, from the worktree root)
Expected: exactly 26 warnings, 0 errors.

Run: `npx vitest run`
Expected: all tests still pass (no new tests added by this task).

- [ ] **Step 9: Commit**

```bash
git add src/hooks/playerActions/betHand.ts src/hooks/playerActions/callHand.ts src/hooks/playerActions/checkHand.ts src/hooks/playerActions/raiseHand.ts src/hooks/playerActions/foldHand.ts src/hooks/playerActions/muckCards.ts src/hooks/playerActions/showCards.ts
git commit -m "feat: add simple manual action hooks (bet/call/check/raise/fold/muck/show)"
```

---

### Task 3: Sit/blind/deal/new-hand hooks and the entropy utility

**Files:**
- Create: `src/hooks/playerActions/sitIn.ts`
- Create: `src/hooks/playerActions/sitInAndWait.ts`
- Create: `src/hooks/playerActions/sitOut.ts`
- Create: `src/hooks/playerActions/postSmallBlind.ts`
- Create: `src/hooks/playerActions/postBigBlind.ts`
- Create: `src/hooks/playerActions/dealCards.ts`
- Create: `src/utils/entropy.ts`
- Create: `src/hooks/playerActions/startNewHand.ts`

**Interfaces:**
- Consumes: `executeTransportAction` from `./transportAction` (Plan 2b); `PlayerActionResult` from `../../types` (Plan 2b); `PlayerActionType`, `NonPlayerActionType`, `SIT_IN_METHOD_POST_NOW`, `SitOutMethod`, `SIT_OUT_METHOD_NEXT_HAND` from `@block52/poker-vm-sdk`.
- Produces: `sitIn`, `sitInAndWait`, `sitOut`, `postSmallBlind`, `postBigBlind`, `dealCards`, `dealCardsWithEntropy`, `startNewHand` — each `(tableId, ...args, network) => Promise<PlayerActionResult>` — consumed by Task 5 (`useAutoDeal` needs `dealCardsWithEntropy`, `useAutoPostBlinds` needs `postSmallBlind`/`postBigBlind`) and Task 6 (`useAutoNewHand` needs `startNewHand`) and Task 7. `generateSystemEntropy(): string` and `generatePlayerSeedHex(): string` from `src/utils/entropy.ts` — `generatePlayerSeedHex` consumed by `startNewHand` in this same task.

No test for this task (see Global Constraints).

- [ ] **Step 1: Create `sitIn.ts`**

Note: this is SIMPLIFIED from `ui`'s version — no `method` parameter. `ui` has a `method: SitInMethod = SIT_IN_METHOD_POST_NOW` parameter backed by a locally-redeclared, stale `SitInMethod` type (with a "TODO: import from SDK" comment). The SDK now exports this directly, and per the spec the next-bb method is a dead path not worth porting — so this hook always submits post-now, with no method parameter at all.

```ts
import { NonPlayerActionType, SIT_IN_METHOD_POST_NOW } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Sit in at a poker table (post-now method — the only live sit-in path;
 * "next-bb" is deferred upstream and not exposed here).
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function sitIn(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, NonPlayerActionType.SIT_IN, 0n, network, `method=${SIT_IN_METHOD_POST_NOW}`);
}
```

- [ ] **Step 2: Create `sitInAndWait.ts`**

```ts
import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Sit in AND wait for the big blind (cash games).
 *
 * Unlike sit-in "post now", this submits the engine's distinct
 * SIT_IN_AND_WAIT action, which parks the player in WAITING_FOR_BIG_BLIND
 * until the big blind rotates onto their seat, then activates them so they
 * enter by posting the BB. No `method=` payload — the wait intent IS the
 * action.
 *
 * @param tableId - Game ID on Cosmos.
 * @param network - Current network configuration from NetworkContext.
 */
export async function sitInAndWait(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, NonPlayerActionType.SIT_IN_AND_WAIT, 0n, network);
}
```

- [ ] **Step 3: Create `sitOut.ts`**

Note: unlike `ui`'s version, this does NOT re-export `SIT_OUT_METHOD_NEXT_BB`/`SitOutMethod` — nothing in this plan's scope consumes them; import directly from the SDK wherever needed.

```ts
import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { SitOutMethod } from "@block52/poker-vm-sdk";
import { SIT_OUT_METHOD_NEXT_HAND } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Sit out in a poker game.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param network - The current network configuration from NetworkContext
 * @param method - The sit-out method: "next-hand" or "next-bb"
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function sitOut(
    tableId: string,
    network: NetworkEndpoints,
    method: SitOutMethod = SIT_OUT_METHOD_NEXT_HAND
): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, NonPlayerActionType.SIT_OUT, 0n, network, `method=${method}`);
}
```

- [ ] **Step 4: Create `postSmallBlind.ts`**

```ts
import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Post small blind in a poker game.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param amount - The small blind amount in micro-units as bigint (10^6 precision)
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function postSmallBlind(tableId: string, amount: bigint, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, PlayerActionType.SMALL_BLIND, amount, network);
}
```

- [ ] **Step 5: Create `postBigBlind.ts`**

```ts
import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Post big blind in a poker game.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param amount - The big blind amount in micro-units as bigint (10^6 precision)
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function postBigBlind(tableId: string, amount: bigint, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, PlayerActionType.BIG_BLIND, amount, network);
}
```

- [ ] **Step 6: Create `dealCards.ts`**

```ts
import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Deal cards in a poker game.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where to deal cards
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function dealCards(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, NonPlayerActionType.DEAL, 0n, network);
}

/**
 * Deal cards with user-provided entropy for provably fair shuffling.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where to deal cards
 * @param network - The current network configuration from NetworkContext
 * @param entropy - The entropy string (hex) to use for deck shuffling
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function dealCardsWithEntropy(
    tableId: string,
    network: NetworkEndpoints,
    entropy: string
): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, NonPlayerActionType.DEAL, 0n, network, entropy);
}
```

- [ ] **Step 7: Create `src/utils/entropy.ts`**

```ts
/**
 * Shared client entropy generation.
 *
 * Used by the new-hand player seed (chain-authoritative deck shuffling).
 * Keeping one generator avoids two copies of the CSPRNG drifting apart.
 */

/**
 * 32-byte (256-bit) system entropy as "0x"+hex, via webcrypto.
 */
export function generateSystemEntropy(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return "0x" + Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * The system entropy as BARE 32-byte hex (no 0x prefix) — the exact format
 * the chain's ParsePlayerSeed expects for a new-hand "seed=<hex>". The
 * acting player carries this on new-hand; the chain folds it into the
 * per-hand VRF, so the client never picks the deck.
 */
export function generatePlayerSeedHex(): string {
    return generateSystemEntropy().slice(2);
}
```

- [ ] **Step 8: Create `startNewHand.ts`**

```ts
import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { generatePlayerSeedHex } from "../../utils/entropy";
import { executeTransportAction } from "./transportAction";

/**
 * Start a new hand at a poker table.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where to start a new hand
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function startNewHand(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    // The chain is the authoritative deck source. The acting player supplies
    // 32 bytes of entropy as data "seed=<hex>"; the chain shuffles the deck
    // deterministically from it. The client never picks the deck.
    const data = `seed=${generatePlayerSeedHex()}`;
    return executeTransportAction(tableId, NonPlayerActionType.NEW_HAND, 0n, network, data);
}
```

- [ ] **Step 9: Verify**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as after Task 2 (62 lines).

Run: `npx eslint --ext .ts,.tsx src` (scoped, from the worktree root)
Expected: exactly 26 warnings, 0 errors.

Run: `npx vitest run`
Expected: all tests still pass (no new tests added by this task).

- [ ] **Step 10: Commit**

```bash
git add src/hooks/playerActions/sitIn.ts src/hooks/playerActions/sitInAndWait.ts src/hooks/playerActions/sitOut.ts src/hooks/playerActions/postSmallBlind.ts src/hooks/playerActions/postBigBlind.ts src/hooks/playerActions/dealCards.ts src/utils/entropy.ts src/hooks/playerActions/startNewHand.ts
git commit -m "feat: add sit/blind/deal/new-hand action hooks and entropy utility"
```

---

### Task 4: `joinTable` + `leaveTable`

**Files:**
- Modify: `src/hooks/playerActions/types.ts` (add `JoinTableOptions`)
- Create: `src/hooks/playerActions/joinTable.ts`
- Create: `src/hooks/playerActions/leaveTable.ts`
- Test: `src/hooks/playerActions/joinTable.test.ts`

**Interfaces:**
- Consumes: `parseUsdcToMicro` from `../../utils/currency` (Task 1); `withMoneyMoverRetry` from `../../utils/cosmos/client` (Plan 2b, already merged); `JoinTableResult`, `LeaveTableResult` from `../../types` (Plan 2b, already merged); `hasValue`, `isNullish` from `../../utils/guards` (existing); `TexasHoldemStateDTO`, `NonPlayerActionType` from `@block52/poker-vm-sdk`.
- Produces: `JoinTableOptions` (`{ amount: string; seatNumber?: number }`) from `./types`. `resolveJoinSeat(requestedSeat: number | undefined, gameState: TexasHoldemStateDTO | undefined): number` (exported for the test, and reused by `joinTable`). `joinTable(tableId: string, options: JoinTableOptions, network: NetworkEndpoints, getLatestSnapshot: () => TexasHoldemStateDTO | undefined): Promise<JoinTableResult>` and `leaveTable(tableId: string, network: NetworkEndpoints): Promise<LeaveTableResult>` — both consumed by Task 7 (`Table.tsx`).

The current `src/hooks/playerActions/types.ts` (from Plan 2b) is:

```ts
import type { LegalActionDTO, PlayerStatus, SitInMethod } from "@block52/poker-vm-sdk";

export interface PlayerLegalActionsResult {
    legalActions: LegalActionDTO[];
    isSmallBlindPosition: boolean;
    isBigBlindPosition: boolean;
    isDealerPosition: boolean;
    isPlayerTurn: boolean;
    playerStatus: PlayerStatus | null;
    playerSeat: number | null;
    sitInMethod: SitInMethod | null;
    pendingSitOut: string | null;
    foldActionIndex: number | null;
    actionTurnIndex: number;
    isPlayerInGame: boolean;
    isLoading: boolean;
    error: Error | null;
}
```

- [ ] **Step 1: Add `JoinTableOptions` to `types.ts`**

Append to `src/hooks/playerActions/types.ts` (leave `PlayerLegalActionsResult` untouched):

```ts
/** Options for joinTable — buy-in amount as decimal-USDC text, plus an optional requested seat. */
export interface JoinTableOptions {
    amount: string;
    seatNumber?: number;
}
```

- [ ] **Step 2: Write the failing test for `resolveJoinSeat`**

Create `src/hooks/playerActions/joinTable.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/hooks/playerActions/joinTable.test.ts`
Expected: FAIL — `./joinTable` does not exist yet.

- [ ] **Step 4: Create `joinTable.ts`**

```ts
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { JoinTableResult } from "../../types";
import type { JoinTableOptions } from "./types";
import { withMoneyMoverRetry } from "../../utils/cosmos/client";
import { parseUsdcToMicro } from "../../utils/currency";
import { hasValue, isNullish } from "../../utils/guards";

/**
 * Resolves the concrete seat a join should claim.
 *
 * "Random seat" used to be expressed as seat 0 ("let the server pick"), but
 * the engine's Sit-and-Go / tournament JOIN does NOT treat 0 as random — it
 * seats the player literally at 0, the "not-seated" sentinel (chain seats
 * are 1-indexed), so the join lands broken. When no seat is requested we
 * therefore pick a real empty seat from the latest broadcast state instead
 * of sending 0.
 */
export function resolveJoinSeat(requestedSeat: number | undefined, gameState: TexasHoldemStateDTO | undefined): number {
    if (hasValue(requestedSeat) && requestedSeat > 0) {
        return requestedSeat;
    }

    const maxPlayers = gameState?.gameOptions?.maxPlayers;
    if (isNullish(maxPlayers)) {
        throw new Error("Cannot resolve a seat to join — game state not loaded yet");
    }

    const occupied = new Set((gameState?.players ?? []).map(p => p.seat));
    for (let seat = 1; seat <= maxPlayers; seat++) {
        if (!occupied.has(seat)) {
            return seat;
        }
    }
    throw new Error("No available seats to join");
}

/**
 * Joins a poker table.
 *
 * `getLatestSnapshot` is supplied by the caller (via `useGameState()`) rather
 * than read from a module-level global — see GameStateContext's accessor.
 *
 * @param tableId - The ID of the table to join (game ID on Cosmos).
 * @param options - Buy-in amount (decimal USDC text) and an optional seat number.
 * @param network - The current network configuration from NetworkContext.
 * @param getLatestSnapshot - Returns the most recently ingested game-state snapshot.
 * @returns The transaction result including hash, gameId, seat, and buyInAmount.
 * @throws If the table ID is not provided or if an error occurs during the join operation.
 */
export async function joinTable(
    tableId: string,
    options: JoinTableOptions,
    network: NetworkEndpoints,
    getLatestSnapshot: () => TexasHoldemStateDTO | undefined
): Promise<JoinTableResult> {
    if (!tableId) {
        throw new Error("Table ID is required to join a table");
    }

    // Convert buy-in amount from USDC to micro-USDC (b52usdc). Parsed directly
    // from text — never routed through a float — so it can't be short by a
    // micro-unit on an ordinary cent amount.
    const buyInAmount = parseUsdcToMicro(options.amount);

    // Resolve a real seat — never the broken seat-0 "random" sentinel.
    const seat = resolveJoinSeat(options.seatNumber, getLatestSnapshot());

    // Broadcast MsgJoinGame chain-direct. JOIN is an ordered money-mover (it
    // carries the account sequence), so retry once on a sequence mismatch
    // caused by a still-pending prior money-mover — otherwise a wedged
    // sequence blocks every join.
    const transactionHash = await withMoneyMoverRetry(network, ({ signingClient }) => signingClient.joinGame(tableId, seat, buyInAmount));

    return {
        hash: transactionHash,
        gameId: tableId,
        seat,
        buyInAmount: buyInAmount.toString(),
    };
}
```

- [ ] **Step 5: Create `leaveTable.ts`**

```ts
import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { LeaveTableResult } from "../../types";
import { withMoneyMoverRetry } from "../../utils/cosmos/client";

/**
 * Leave a poker table by broadcasting MsgLeaveGame.
 *
 * MsgLeaveGame carries only {creator, gameId} — the chain decides the refund
 * amount from its own state. The client does NOT pass a value.
 *
 * @param tableId - The game ID on Cosmos
 * @param network - Current network configuration from NetworkContext
 * @returns Promise with LeaveTableResult containing transaction hash + action discriminator
 * @throws Error if Cosmos wallet is not initialized or if the chain rejects the leave
 */
export async function leaveTable(tableId: string, network: NetworkEndpoints): Promise<LeaveTableResult> {
    // Broadcast MsgLeaveGame chain-direct. LEAVE is an ordered money-mover, so
    // retry once on a sequence mismatch from a still-pending prior money-mover.
    const hash = await withMoneyMoverRetry(network, ({ signingClient }) => signingClient.leaveGame(tableId));
    return { hash, gameId: tableId, action: NonPlayerActionType.LEAVE };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/hooks/playerActions/joinTable.test.ts`
Expected: PASS, all 5 cases.

- [ ] **Step 7: Verify no regressions**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as after Task 3 (62 lines).

Run: `npx eslint --ext .ts,.tsx src` (scoped, from the worktree root)
Expected: exactly 26 warnings, 0 errors.

Run: `npx vitest run`
Expected: all tests pass (Task 1's 13 new + this task's 5 new + the pre-existing 75 = 93).

- [ ] **Step 8: Commit**

```bash
git add src/hooks/playerActions/types.ts src/hooks/playerActions/joinTable.ts src/hooks/playerActions/leaveTable.ts src/hooks/playerActions/joinTable.test.ts
git commit -m "feat: add joinTable and leaveTable hooks"
```

---

### Task 5: `useAutoDeal` + `useAutoPostBlinds`

**Files:**
- Create: `src/hooks/playerActions/useAutoDeal.ts`
- Create: `src/hooks/playerActions/useAutoPostBlinds.ts`

**Interfaces:**
- Consumes: `dealCardsWithEntropy` from `./dealCards` (Task 3); `postSmallBlind`, `postBigBlind` from `./postSmallBlind`/`./postBigBlind` (Task 3).
- Produces: `useAutoDeal(tableId, network, hasDealAction, isUsersTurn, onDealStarted?, onDealComplete?, onDealError?, enabled?): void` and `useAutoPostBlinds(tableId, network, hasSmallBlindAction, hasBigBlindAction, smallBlindAmount, bigBlindAmount, isUsersTurn, onBlindStarted?, onBlindComplete?, onBlindError?, enabled?): void` — both consumed by Task 7 (`Table.tsx`).

No test for this task (see Global Constraints).

- [ ] **Step 1: Create `useAutoDeal.ts`**

```ts
import { useCallback, useEffect, useRef } from "react";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { dealCardsWithEntropy } from "./dealCards";

/**
 * Automatically triggers the deal action when conditions are met.
 *
 * Enabled by default; pass `enabled={false}` to turn it off.
 *
 * When enabled, triggers deal when:
 * 1. The user has the DEAL action in their legal actions
 * 2. It is the user's turn
 * 3. Auto-deal has not already been triggered for this deal opportunity
 *
 * @param tableId - The table/game ID
 * @param network - The network configuration
 * @param hasDealAction - Whether the DEAL action is available in legal actions
 * @param isUsersTurn - Whether it is currently the user's turn
 * @param onDealStarted - Optional callback when auto-deal starts
 * @param onDealComplete - Optional callback when auto-deal completes
 * @param onDealError - Optional callback when auto-deal fails
 * @param enabled - Optional on/off override, defaults to true
 */
export function useAutoDeal(
    tableId: string,
    network: NetworkEndpoints,
    hasDealAction: boolean,
    isUsersTurn: boolean,
    onDealStarted?: () => void,
    onDealComplete?: (txHash: string) => void,
    onDealError?: (error: Error) => void,
    enabled?: boolean
): void {
    // Track if we've already triggered deal for this opportunity
    const hasTriggeredRef = useRef<boolean>(false);
    // Track if deal is currently in progress to prevent duplicate calls
    const isProcessingRef = useRef<boolean>(false);
    const autoDealEnabledRef = useRef<boolean>(enabled ?? true);

    useEffect(() => {
        autoDealEnabledRef.current = enabled ?? true;
    }, [enabled]);

    const triggerAutoDeal = useCallback(async () => {
        if (!tableId || isProcessingRef.current) {
            return;
        }

        isProcessingRef.current = true;
        onDealStarted?.();

        try {
            const result = await dealCardsWithEntropy(tableId, network, "");
            onDealComplete?.(result.hash);
        } catch (error) {
            console.error("Auto-deal failed:", error);
            onDealError?.(error instanceof Error ? error : new Error(String(error)));
        } finally {
            isProcessingRef.current = false;
        }
    }, [tableId, network, onDealStarted, onDealComplete, onDealError]);

    useEffect(() => {
        const shouldAutoDeal =
            autoDealEnabledRef.current && hasDealAction && isUsersTurn && !hasTriggeredRef.current && !isProcessingRef.current;

        if (shouldAutoDeal) {
            hasTriggeredRef.current = true;
            triggerAutoDeal();
        }

        // Reset the trigger flag when deal action is no longer available,
        // so auto-deal can fire again on the next hand.
        if (!hasDealAction) {
            hasTriggeredRef.current = false;
        }
    }, [hasDealAction, isUsersTurn, triggerAutoDeal]);
}
```

- [ ] **Step 2: Create `useAutoPostBlinds.ts`**

```ts
import { useCallback, useEffect, useRef } from "react";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { postSmallBlind } from "./postSmallBlind";
import { postBigBlind } from "./postBigBlind";

/**
 * Automatically posts the small or big blind when conditions are met.
 *
 * Enabled by default; pass `enabled={false}` to turn it off.
 *
 * When enabled, posts a blind when:
 * 1. The user has the SMALL_BLIND or BIG_BLIND action in their legal actions
 * 2. It is the user's turn
 * 3. The blind has not already been posted for this opportunity
 *
 * @param tableId - The table/game ID
 * @param network - The network configuration
 * @param hasSmallBlindAction - Whether the SMALL_BLIND action is available in legal actions
 * @param hasBigBlindAction - Whether the BIG_BLIND action is available in legal actions
 * @param smallBlindAmount - The small blind amount in micro-units as bigint
 * @param bigBlindAmount - The big blind amount in micro-units as bigint
 * @param isUsersTurn - Whether it is currently the user's turn
 * @param onBlindStarted - Optional callback when auto-post blind starts
 * @param onBlindComplete - Optional callback when auto-post blind completes
 * @param onBlindError - Optional callback when auto-post blind fails
 * @param enabled - Optional on/off override, defaults to true
 */
export function useAutoPostBlinds(
    tableId: string,
    network: NetworkEndpoints,
    hasSmallBlindAction: boolean,
    hasBigBlindAction: boolean,
    smallBlindAmount: bigint,
    bigBlindAmount: bigint,
    isUsersTurn: boolean,
    onBlindStarted?: (blindType: "small" | "big") => void,
    onBlindComplete?: (blindType: "small" | "big", txHash: string) => void,
    onBlindError?: (error: Error) => void,
    enabled?: boolean
): void {
    const hasTriggeredSmallBlindRef = useRef<boolean>(false);
    const hasTriggeredBigBlindRef = useRef<boolean>(false);
    const isProcessingRef = useRef<boolean>(false);
    const autoPostBlindsEnabledRef = useRef<boolean>(enabled ?? true);

    useEffect(() => {
        autoPostBlindsEnabledRef.current = enabled ?? true;
    }, [enabled]);

    const triggerPostSmallBlind = useCallback(async () => {
        if (!tableId || isProcessingRef.current || smallBlindAmount === 0n) {
            return;
        }

        isProcessingRef.current = true;
        onBlindStarted?.("small");

        try {
            const result = await postSmallBlind(tableId, smallBlindAmount, network);
            onBlindComplete?.("small", result.hash);
        } catch (error) {
            console.error("Auto-post small blind failed:", error);
            onBlindError?.(error instanceof Error ? error : new Error(String(error)));
        } finally {
            isProcessingRef.current = false;
        }
    }, [tableId, network, smallBlindAmount, onBlindStarted, onBlindComplete, onBlindError]);

    const triggerPostBigBlind = useCallback(async () => {
        if (!tableId || isProcessingRef.current || bigBlindAmount === 0n) {
            return;
        }

        isProcessingRef.current = true;
        onBlindStarted?.("big");

        try {
            const result = await postBigBlind(tableId, bigBlindAmount, network);
            onBlindComplete?.("big", result.hash);
        } catch (error) {
            console.error("Auto-post big blind failed:", error);
            onBlindError?.(error instanceof Error ? error : new Error(String(error)));
        } finally {
            isProcessingRef.current = false;
        }
    }, [tableId, network, bigBlindAmount, onBlindStarted, onBlindComplete, onBlindError]);

    useEffect(() => {
        const shouldPostSmallBlind =
            autoPostBlindsEnabledRef.current &&
            hasSmallBlindAction &&
            isUsersTurn &&
            !hasTriggeredSmallBlindRef.current &&
            !isProcessingRef.current;

        if (shouldPostSmallBlind) {
            hasTriggeredSmallBlindRef.current = true;
            triggerPostSmallBlind();
        }

        if (!hasSmallBlindAction) {
            hasTriggeredSmallBlindRef.current = false;
        }
    }, [hasSmallBlindAction, isUsersTurn, triggerPostSmallBlind]);

    useEffect(() => {
        const shouldPostBigBlind =
            autoPostBlindsEnabledRef.current &&
            hasBigBlindAction &&
            isUsersTurn &&
            !hasTriggeredBigBlindRef.current &&
            !isProcessingRef.current;

        if (shouldPostBigBlind) {
            hasTriggeredBigBlindRef.current = true;
            triggerPostBigBlind();
        }

        if (!hasBigBlindAction) {
            hasTriggeredBigBlindRef.current = false;
        }
    }, [hasBigBlindAction, isUsersTurn, triggerPostBigBlind]);
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as after Task 4 (62 lines).

Run: `npx eslint --ext .ts,.tsx src` (scoped, from the worktree root)
Expected: exactly 26 warnings, 0 errors.

Run: `npx vitest run`
Expected: all tests still pass (no new tests added by this task).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/playerActions/useAutoDeal.ts src/hooks/playerActions/useAutoPostBlinds.ts
git commit -m "feat: add useAutoDeal and useAutoPostBlinds hooks"
```

---

### Task 6: `useAutoNewHand`

**Files:**
- Create: `src/hooks/playerActions/useAutoNewHand.ts`

**Interfaces:**
- Consumes: `startNewHand` from `./startNewHand` (Task 3); `useGameState` (`getLatestSnapshot`, `latestEvents` fields) from `../../context/GameStateContext` (Plan 2a, already merged); `getCosmosAddress` from `../../utils/cosmos/storage` (existing); `NonPlayerActionType` from `@block52/poker-vm-sdk`.
- Produces: `useAutoNewHand(tableId, network, onNewHandStarted?, onNewHandComplete?, onNewHandError?, enabled?): { isDealingNewHand: boolean }` — consumed by Task 7 (`Table.tsx`).

No test for this task (see Global Constraints).

- [ ] **Step 1: Create `useAutoNewHand.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { startNewHand } from "./startNewHand";
import { useGameState } from "../../context/GameStateContext";
import { getCosmosAddress } from "../../utils/cosmos/storage";

/**
 * Automatically triggers a new hand when the current hand ends.
 *
 * Enabled by default; pass `enabled={false}` to turn it off.
 *
 * Triggers the new-hand action when:
 * 1. The user has the NEW_HAND action in their legal actions
 * 2. It is the user's turn
 * 3. Auto-new-hand has not already been triggered for this opportunity
 *
 * Because dealing a new hand is an action SUBMISSION, its trigger inputs
 * are derived from `getLatestSnapshot()` (the freshest ingested snapshot),
 * NOT any paced/rendered state — a delayed snapshot would submit against a
 * stale action index. `latestEvents` is read only as the reactive tick that
 * re-runs the check on each commit; the DATA read is always the latest
 * snapshot.
 *
 * @param tableId - The table/game ID
 * @param network - The network configuration
 * @param onNewHandStarted - Optional callback when auto-new-hand starts
 * @param onNewHandComplete - Optional callback when auto-new-hand completes
 * @param onNewHandError - Optional callback when auto-new-hand fails
 * @param enabled - Optional on/off override, defaults to true
 * @returns `{ isDealingNewHand }` — true from the hand-ended commit until the
 *          next hand starts (or the deal fails), so the UI can show a
 *          "Dealing hand #X…" indicator.
 */
export function useAutoNewHand(
    tableId: string,
    network: NetworkEndpoints,
    onNewHandStarted?: () => void,
    onNewHandComplete?: (txHash: string) => void,
    onNewHandError?: (error: Error) => void,
    enabled?: boolean
): { isDealingNewHand: boolean } {
    const hasTriggeredRef = useRef<boolean>(false);
    const isProcessingRef = useRef<boolean>(false);
    const autoNewHandEnabledRef = useRef<boolean>(enabled ?? true);
    const [isDealingNewHand, setIsDealingNewHand] = useState<boolean>(false);

    // Wallet address is stable for the session — read once.
    const [localAddress] = useState<string | null>(() => {
        const address = getCosmosAddress();
        return address ? address.toLowerCase() : null;
    });

    const { getLatestSnapshot, latestEvents } = useGameState();

    useEffect(() => {
        autoNewHandEnabledRef.current = enabled ?? true;
    }, [enabled]);

    const triggerAutoNewHand = useCallback(async () => {
        if (!tableId || isProcessingRef.current) {
            return;
        }

        isProcessingRef.current = true;
        onNewHandStarted?.();

        try {
            const result = await startNewHand(tableId, network);
            onNewHandComplete?.(result.hash);
            // Leave isDealingNewHand true on success — cleared by the effect
            // below when the next hand starts (hasNewHandAction goes false).
        } catch (error) {
            console.error("Auto-new-hand failed:", error);
            setIsDealingNewHand(false);
            onNewHandError?.(error instanceof Error ? error : new Error(String(error)));
        } finally {
            isProcessingRef.current = false;
        }
    }, [tableId, network, onNewHandStarted, onNewHandComplete, onNewHandError]);

    useEffect(() => {
        // `latestEvents` is the reactive tick only; the decision reads the
        // latest snapshot directly so the deal is never delayed by pacing.
        void latestEvents;
        const snapshot = getLatestSnapshot();
        const localPlayer = snapshot?.players.find(player => player.address.toLowerCase() === localAddress);
        const hasNewHandAction = !!localPlayer?.legalActions.some(action => action.action === NonPlayerActionType.NEW_HAND);
        const isUsersTurn = !!localPlayer && snapshot?.nextToAct === localPlayer.seat;

        const shouldAutoNewHand =
            autoNewHandEnabledRef.current && hasNewHandAction && isUsersTurn && !hasTriggeredRef.current && !isProcessingRef.current;

        if (shouldAutoNewHand) {
            hasTriggeredRef.current = true;
            setIsDealingNewHand(true);
            triggerAutoNewHand();
        }

        // New-hand opportunity gone (a hand started — by us or another
        // player). Reset so the next hand-end re-arms, and drop the
        // dealing indicator.
        if (!hasNewHandAction) {
            hasTriggeredRef.current = false;
            setIsDealingNewHand(false);
        }
    }, [latestEvents, getLatestSnapshot, localAddress, triggerAutoNewHand]);

    return { isDealingNewHand };
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as after Task 5 (62 lines).

Run: `npx eslint --ext .ts,.tsx src` (scoped, from the worktree root)
Expected: exactly 26 warnings, 0 errors.

Run: `npx vitest run`
Expected: all tests still pass (no new tests added by this task).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/playerActions/useAutoNewHand.ts
git commit -m "feat: add useAutoNewHand hook"
```

---

### Task 7: Wire the action buttons into `Table.tsx`'s debug page

**Files:**
- Modify: `src/pages/table/Table.tsx`

**Interfaces:**
- Consumes: every hook produced by Tasks 2-6; `usePlayerLegalActions` from `../../hooks/playerActions/usePlayerLegalActions` (Plan 2b, already merged); `useNetwork` from `../../context/NetworkContext` (existing); `hasAction` from `@block52/poker-vm-sdk`; `parseUsdcToMicro` from `../../utils/currency` (Task 1).
- Produces: nothing consumed by later tasks — this is the final task in this plan.

The current `src/pages/table/Table.tsx` (from Plan 1) is:

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

- [ ] **Step 1: Replace `Table.tsx` with the wired debug page**

```tsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PlayerActionType, NonPlayerActionType, hasAction } from "@block52/poker-vm-sdk";
import { useGameState } from "../../context/GameStateContext";
import { useNetwork } from "../../context/NetworkContext";
import { usePlayerLegalActions } from "../../hooks/playerActions/usePlayerLegalActions";
import { betHand } from "../../hooks/playerActions/betHand";
import { callHand } from "../../hooks/playerActions/callHand";
import { checkHand } from "../../hooks/playerActions/checkHand";
import { raiseHand } from "../../hooks/playerActions/raiseHand";
import { foldHand } from "../../hooks/playerActions/foldHand";
import { muckCards } from "../../hooks/playerActions/muckCards";
import { showCards } from "../../hooks/playerActions/showCards";
import { sitIn } from "../../hooks/playerActions/sitIn";
import { sitInAndWait } from "../../hooks/playerActions/sitInAndWait";
import { sitOut } from "../../hooks/playerActions/sitOut";
import { joinTable } from "../../hooks/playerActions/joinTable";
import { leaveTable } from "../../hooks/playerActions/leaveTable";
import { useAutoDeal } from "../../hooks/playerActions/useAutoDeal";
import { useAutoPostBlinds } from "../../hooks/playerActions/useAutoPostBlinds";
import { useAutoNewHand } from "../../hooks/playerActions/useAutoNewHand";
import { parseUsdcToMicro } from "../../utils/currency";
import type { PlayerActionResult, JoinTableResult, LeaveTableResult } from "../../types";

const Table: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const tableId = id ?? "";
    const { currentNetwork } = useNetwork();
    const { gameState, isLoading, error, validationError, latestEvents, subscribeToTable, unsubscribeFromTable, getLatestSnapshot } =
        useGameState();
    const legalActions = usePlayerLegalActions();

    const [betAmount, setBetAmount] = useState<string>("");
    const [callAmount, setCallAmount] = useState<string>("");
    const [raiseAmount, setRaiseAmount] = useState<string>("");
    const [buyInAmount, setBuyInAmount] = useState<string>("");
    const [seatNumber, setSeatNumber] = useState<string>("");
    const [actionStatus, setActionStatus] = useState<string>("");
    const [actionError, setActionError] = useState<string>("");

    useEffect(() => {
        if (!id) {
            return;
        }
        subscribeToTable(id);
        return () => {
            unsubscribeFromTable();
        };
    }, [id, subscribeToTable, unsubscribeFromTable]);

    const runAction = async (label: string, action: () => Promise<PlayerActionResult | JoinTableResult | LeaveTableResult>) => {
        setActionStatus(`${label}…`);
        setActionError("");
        try {
            const result = await action();
            setActionStatus(`${label} ok: ${result.hash}`);
        } catch (err) {
            setActionError(err instanceof Error ? err.message : String(err));
            setActionStatus("");
        }
    };

    const smallBlindAmount = gameState ? BigInt(gameState.gameOptions.smallBlind) : 0n;
    const bigBlindAmount = gameState ? BigInt(gameState.gameOptions.bigBlind) : 0n;

    useAutoPostBlinds(
        tableId,
        currentNetwork,
        hasAction(legalActions.legalActions, PlayerActionType.SMALL_BLIND),
        hasAction(legalActions.legalActions, PlayerActionType.BIG_BLIND),
        smallBlindAmount,
        bigBlindAmount,
        legalActions.isPlayerTurn,
        blindType => setActionStatus(`Auto-posting ${blindType} blind…`),
        (blindType, txHash) => setActionStatus(`Auto-posted ${blindType} blind: ${txHash}`),
        err => setActionError(err.message)
    );

    useAutoDeal(
        tableId,
        currentNetwork,
        hasAction(legalActions.legalActions, NonPlayerActionType.DEAL),
        legalActions.isPlayerTurn,
        () => setActionStatus("Auto-dealing…"),
        txHash => setActionStatus(`Auto-dealt: ${txHash}`),
        err => setActionError(err.message)
    );

    const { isDealingNewHand } = useAutoNewHand(
        tableId,
        currentNetwork,
        () => setActionStatus("Auto-starting new hand…"),
        txHash => setActionStatus(`Auto-started new hand: ${txHash}`),
        err => setActionError(err.message)
    );

    return (
        <div style={{ padding: 16, fontFamily: "monospace", color: "#fff" }}>
            <h1>Table {id}</h1>
            {isLoading && <p>Connecting…</p>}
            {error && <p style={{ color: "#ef4444" }}>Error: {error.message}</p>}
            {validationError && <p style={{ color: "#f59e0b" }}>Validation: {validationError.message}</p>}
            {isDealingNewHand && <p style={{ color: "#22d3ee" }}>Dealing next hand…</p>}
            {actionStatus && <p style={{ color: "#22c55e" }}>{actionStatus}</p>}
            {actionError && <p style={{ color: "#ef4444" }}>Action error: {actionError}</p>}

            <h2>Join / Leave</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input placeholder="Buy-in (USDC)" value={buyInAmount} onChange={e => setBuyInAmount(e.target.value)} />
                <input placeholder="Seat (optional)" value={seatNumber} onChange={e => setSeatNumber(e.target.value)} />
                <button
                    onClick={() =>
                        runAction("Join", () =>
                            joinTable(
                                tableId,
                                { amount: buyInAmount, seatNumber: seatNumber ? Number(seatNumber) : undefined },
                                currentNetwork,
                                getLatestSnapshot
                            )
                        )
                    }
                >
                    Join
                </button>
                <button onClick={() => runAction("Leave", () => leaveTable(tableId, currentNetwork))}>Leave</button>
            </div>

            <h2>In-hand actions</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input placeholder="Bet (USDC)" value={betAmount} onChange={e => setBetAmount(e.target.value)} />
                <button onClick={() => runAction("Bet", () => betHand(tableId, parseUsdcToMicro(betAmount), currentNetwork))}>Bet</button>
                <input placeholder="Call (USDC)" value={callAmount} onChange={e => setCallAmount(e.target.value)} />
                <button onClick={() => runAction("Call", () => callHand(tableId, parseUsdcToMicro(callAmount), currentNetwork))}>Call</button>
                <input placeholder="Raise (USDC)" value={raiseAmount} onChange={e => setRaiseAmount(e.target.value)} />
                <button onClick={() => runAction("Raise", () => raiseHand(tableId, parseUsdcToMicro(raiseAmount), currentNetwork))}>
                    Raise
                </button>
                <button onClick={() => runAction("Check", () => checkHand(tableId, currentNetwork))}>Check</button>
                <button onClick={() => runAction("Fold", () => foldHand(tableId, currentNetwork))}>Fold</button>
                <button onClick={() => runAction("Muck", () => muckCards(tableId, currentNetwork))}>Muck</button>
                <button onClick={() => runAction("Show", () => showCards(tableId, currentNetwork))}>Show</button>
            </div>

            <h2>Sit in / out</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={() => runAction("Sit in", () => sitIn(tableId, currentNetwork))}>Sit In</button>
                <button onClick={() => runAction("Sit in and wait", () => sitInAndWait(tableId, currentNetwork))}>Sit In And Wait</button>
                <button onClick={() => runAction("Sit out", () => sitOut(tableId, currentNetwork))}>Sit Out</button>
            </div>

            <h2>Legal actions</h2>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(legalActions, null, 2)}</pre>

            <h2>Latest events ({latestEvents.length})</h2>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(latestEvents, null, 2)}</pre>
            <h2>Raw game state</h2>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{gameState ? JSON.stringify(gameState, null, 2) : "(no state yet)"}</pre>
        </div>
    );
};

export default Table;
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as after Task 6 (62 lines).

Run: `npx eslint --ext .ts,.tsx src` (scoped, from the worktree root)
Expected: exactly 26 warnings, 0 errors.

Run: `npx vitest run`
Expected: all tests pass (Task 1's 13 new + Task 4's 5 new + the pre-existing 75 = 93 — no new tests added by this task).

Run: `yarn start`, then manually: navigate to a table, confirm the page renders without console errors, confirm the new buttons/inputs render, confirm clicking a button (e.g. Fold, when no wallet/table context makes it legal) surfaces an error message via the `actionError` display rather than crashing the page. Full end-to-end verification (join a table, watch blinds/deal fire automatically, exercise each manual action, confirm a showdown resolves and the next hand starts automatically) requires a live table and wallet — this is the spec's stated manual-verification step, not automatable in this plan.

- [ ] **Step 3: Commit**

```bash
git add src/pages/table/Table.tsx
git commit -m "feat: wire action buttons into Table.tsx debug page"
```

---

## Self-Review Notes

- **Spec coverage:** all 11 manual hooks and all 3 auto-only hooks from the spec's "Plan 2c" section are covered (Tasks 2-6), plus the debug-page wiring (Task 7) and the two supporting utilities (`parseUsdcToMicro` in Task 1, `entropy.ts` in Task 3) the spec's hooks depend on. `claimWinnings`, `useAutoFold`/`useAutoMuck`/`useAutoShowCards`, `useAutoSitOutNextBB`, and Sit & Go support remain explicitly out of scope, matching the spec's "Explicitly out of scope" section — no task touches them.
- **Type consistency:** `JoinTableOptions` (Task 4) matches what `joinTable` (Task 4) and `Table.tsx` (Task 7) both use. `getLatestSnapshot: () => TexasHoldemStateDTO | undefined` is used identically in `joinTable`'s signature (Task 4, dependency-injected) and `useAutoNewHand`'s internal `useGameState()` call (Task 6, called directly since it's a hook) — the two different consumption patterns for the same accessor are intentional, not an inconsistency (a plain function needs it injected; a hook can call `useGameState()` itself).
- **No regression:** no task in this plan modifies `GameStateContext.tsx`, `GameMessageBus.ts`, `client.ts`, `transportAction.ts`, or `usePlayerLegalActions.ts` — all from Plan 2a/2b, already merged and reviewed. `convertAmountToBigInt` (Task 1) and its existing callers are untouched.
