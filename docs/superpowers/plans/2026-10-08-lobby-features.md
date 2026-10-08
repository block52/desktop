# Lobby Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining gap between the Lobby/Dashboard and the reference mockup: a featured Sit & Go hero card, live open-tables/seated/avg-block-time stats, format filter tabs on the table list, and a full Create Table flow backed by the SDK's existing `createGame()`.

**Architecture:** `Dashboard.tsx` gains its own `useFindGames()` call feeding two new presentational components (`FeaturedTable`, `LiveStats`) via props; `TableList.tsx` keeps its own independent `useFindGames()` call unchanged and gains local filter-tab state. A new pure hook (`useAvgBlockTime`) and a new pure heuristic function (`selectFeaturedGame`) are the two genuinely-new pieces of logic, both unit tested. Create Table follows the codebase's existing action-function convention (a plain async function in `src/hooks/`, not a stateful hook — the calling component owns submitting-state, exactly like `Table.tsx`'s `runAction` wraps `joinTable`/`betHand`/etc.) plus a new modal matching the existing `DepositModal`/`SendModal`/`WithdrawModal` visual/structural pattern.

**Tech Stack:** React + TypeScript, CSS Modules, `@block52/poker-vm-sdk`, `vitest`.

**Spec:** `docs/superpowers/specs/2026-10-08-lobby-features-design.md`

## Global Constraints

- Theme tokens already exist in `src/index.css` (dark-only): `--bg-app`, `--bg-card`, `--border`, `--border-strong`, `--text`, `--text-muted`, `--accent`, `--accent-text`, `--danger`, `--radius: 12px`. Radius exceptions: `999px` pills/badges, `50%` circles, `2px`/`4px` mini-cards. All new chrome (cards, buttons, inputs) uses `var(--radius)`; pills use `999px`.
- CSS Modules convention: `ComponentName.module.css` + `import styles from "./X.module.css"` + `className={styles.foo}`. Double quotes in all TS/TSX.
- `GameWithFormat` type lives in `src/utils/convertUtils.ts:3-17` — extend it, don't duplicate it.
- `parseUsdcToMicro(value: string): bigint` (`src/utils/currency.ts:25`) converts decimal USDC text to micro-USDC — use it for every USDC form input, never a manual float multiply.
- `withMoneyMoverRetry<T>(network: NetworkEndpoints, fn: (client: SigningClientResult) => Promise<T>): Promise<T>` (`src/utils/cosmos/client.ts:276`) is the established wrapper for signed chain transactions that could race a pending money-mover — `joinTable` (`src/hooks/playerActions/joinTable.ts:68`) is the reference example. Use it for `createGame` too — it's also a signed, costed transaction.
- Action-function convention: a plain exported async function (not a React hook) that throws on error and returns a typed result — the calling component manages its own `isSubmitting`/error state around the call (see `Table.tsx:72-83`'s `runAction`). Do not wrap `createGame` in a stateful custom hook.
- No `||`/`??` as fallbacks for SDK values per CLAUDE.md's "no defaults policy" — this applies to every new line of code in this plan (pre-existing violations elsewhere are not this plan's concern).
- `tsc --noEmit` baseline: 61 pre-existing errors (unrelated). `yarn lint`: 26 warnings / 0 errors (unrelated). `yarn vitest run`: 110 passing / 9 files before this plan starts — every task's new test files add to this count, never replace it.
- Manual visual verification restart command, used throughout: `pkill -f "Application Support/desktop" 2>/dev/null; pkill -f "block52/desktop/node_modules/electron" 2>/dev/null; pkill -f "electron-forge" 2>/dev/null; sleep 3; yarn start` (run in background, check output after ~8s).

---

### Task 1: `useAvgBlockTime` hook

**Files:**
- Create: `src/hooks/useAvgBlockTime.ts`
- Test: `src/hooks/useAvgBlockTime.test.ts`

**Interfaces:**
- Consumes: `getCosmosClient({ rpc, rest })` from `../utils/cosmos/client` (existing), `useNetwork()` from `../context/NetworkContext` (existing, returns `{ currentNetwork }`).
- Produces: `useAvgBlockTime(): { avgBlockTimeSeconds: number | null; isLoading: boolean }`, consumed by Task 4 (`LiveStats`).

- [ ] **Step 1: Write the failing test for the pure averaging logic**

Extract the averaging math into its own exported pure function so it's testable without mocking a network client:

```ts
// src/hooks/useAvgBlockTime.test.ts
import { describe, it, expect } from "vitest";
import { computeAvgBlockTimeSeconds } from "./useAvgBlockTime";

describe("computeAvgBlockTimeSeconds", () => {
    it("averages the deltas between consecutive block timestamps", () => {
        // Blocks newest-first (as getLatestBlocks returns them), 12s apart each.
        const times = [
            "2026-01-01T00:01:00.000Z",
            "2026-01-01T00:00:48.000Z",
            "2026-01-01T00:00:36.000Z",
        ];
        expect(computeAvgBlockTimeSeconds(times)).toBe(12);
    });

    it("handles uneven deltas by averaging them", () => {
        const times = [
            "2026-01-01T00:01:00.000Z",
            "2026-01-01T00:00:50.000Z", // 10s delta
            "2026-01-01T00:00:30.000Z", // 20s delta
        ];
        expect(computeAvgBlockTimeSeconds(times)).toBe(15);
    });

    it("returns null when fewer than 2 timestamps are given", () => {
        expect(computeAvgBlockTimeSeconds([])).toBeNull();
        expect(computeAvgBlockTimeSeconds(["2026-01-01T00:00:00.000Z"])).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/hooks/useAvgBlockTime.test.ts`
Expected: FAIL — `useAvgBlockTime.ts` doesn't exist yet, or `computeAvgBlockTimeSeconds` isn't exported.

- [ ] **Step 3: Write the implementation**

```ts
// src/hooks/useAvgBlockTime.ts
import { useState, useEffect, useCallback } from "react";
import { getCosmosClient } from "../utils/cosmos/client";
import { useNetwork } from "../context/NetworkContext";

const POLL_INTERVAL_MS = 15000;
const BLOCK_SAMPLE_SIZE = 5;

/**
 * Averages the gaps between consecutive block timestamps (newest-first, as
 * getLatestBlocks returns them). Needs at least 2 timestamps to produce a
 * delta; returns null otherwise.
 */
export function computeAvgBlockTimeSeconds(blockTimesNewestFirst: string[]): number | null {
    if (blockTimesNewestFirst.length < 2) return null;

    const deltas: number[] = [];
    for (let i = 0; i < blockTimesNewestFirst.length - 1; i++) {
        const newer = new Date(blockTimesNewestFirst[i]).getTime();
        const older = new Date(blockTimesNewestFirst[i + 1]).getTime();
        deltas.push((newer - older) / 1000);
    }

    return deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
}

export interface UseAvgBlockTimeReturn {
    avgBlockTimeSeconds: number | null;
    isLoading: boolean;
}

export function useAvgBlockTime(): UseAvgBlockTimeReturn {
    const { currentNetwork } = useNetwork();
    const [avgBlockTimeSeconds, setAvgBlockTimeSeconds] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchAvgBlockTime = useCallback(async () => {
        try {
            const cosmosClient = getCosmosClient({
                rpc: currentNetwork.rpc,
                rest: currentNetwork.rest,
            });
            if (!cosmosClient) return;

            const blocks = await cosmosClient.getLatestBlocks(BLOCK_SAMPLE_SIZE);
            const times = blocks.map(b => b.block.header.time);
            setAvgBlockTimeSeconds(computeAvgBlockTimeSeconds(times));
        } catch {
            setAvgBlockTimeSeconds(null);
        } finally {
            setIsLoading(false);
        }
    }, [currentNetwork]);

    useEffect(() => {
        fetchAvgBlockTime();
        const interval = setInterval(fetchAvgBlockTime, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [fetchAvgBlockTime]);

    return { avgBlockTimeSeconds, isLoading };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/hooks/useAvgBlockTime.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Verify baselines**

Run: `yarn tsc --noEmit 2>&1 | grep -c "error TS"` — expect 61 (unchanged).
Run: `yarn lint 2>&1 | tail -5` — expect 26 warnings / 0 errors (unchanged).
Run: `yarn vitest run 2>&1 | tail -10` — expect 113 passed / 10 files (110 + 3 new).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useAvgBlockTime.ts src/hooks/useAvgBlockTime.test.ts
git commit -m "feat: add useAvgBlockTime hook"
```

---

### Task 2: `GameWithFormat.sngStartTime` + `selectFeaturedGame` heuristic

**Files:**
- Modify: `src/utils/convertUtils.ts`
- Create: `src/utils/selectFeaturedGame.ts`
- Test: `src/utils/selectFeaturedGame.test.ts`

**Interfaces:**
- Consumes: `GameWithFormat` from `./convertUtils` (extended by this task), `isTournamentFormat` from `@block52/poker-vm-sdk` is NOT used here (Sit & Go detection, below, follows `TableList.tsx`'s existing string-matching convention, not a direct enum import, for consistency with that file).
- Produces: `selectFeaturedGame(games: GameWithFormat[]): GameWithFormat | null`, consumed by Task 3 (`FeaturedTable`) and Task 5 (`Dashboard.tsx` wiring).

- [ ] **Step 1: Add `sngStartTime` to `GameWithFormat` and its conversion**

In `src/utils/convertUtils.ts`, the interface currently reads (lines 3-17):

```ts
export interface GameWithFormat {
    gameId: string;
    minBuyIn: string;
    maxBuyIn: string;
    minPlayers: number;
    maxPlayers: number;
    currentPlayers: number;
    gameFormat: GameFormat | "unknown";
    gameVariant: GameVariant | "unknown";
    smallBlind: string;
    bigBlind: string;
    creator?: string;
    timeout?: number;
    createdAt?: string;
}
```

Add one field:

```ts
export interface GameWithFormat {
    gameId: string;
    minBuyIn: string;
    maxBuyIn: string;
    minPlayers: number;
    maxPlayers: number;
    currentPlayers: number;
    gameFormat: GameFormat | "unknown";
    gameVariant: GameVariant | "unknown";
    smallBlind: string;
    bigBlind: string;
    creator?: string;
    timeout?: number;
    createdAt?: string;
    sngStartTime?: number;
}
```

And in `convertGameListItemToGameWithFormat` (lines 19-37), add one line to the returned object, reading it off `opts` (confirmed present on the SDK's `GameOptionsDTO` at `node_modules/@block52/poker-vm-sdk/dist/index.d.ts:45404`):

```ts
export const convertGameListItemToGameWithFormat = (game: GameListItem): GameWithFormat => {
    if (!game.gameOptions) throw new Error(`Game ${game.gameId} is missing gameOptions`);
    const opts = game.gameOptions;
    return {
        gameId:         game.gameId,
        minBuyIn:       opts.minBuyIn,
        maxBuyIn:       opts.maxBuyIn,
        minPlayers:     opts.minPlayers,
        maxPlayers:     opts.maxPlayers,
        currentPlayers: game.currentPlayers ?? 0,
        gameFormat:     getGameFormat(game.format),
        gameVariant:    getGameVariant(game.variant),
        smallBlind:     opts.smallBlind,
        bigBlind:       opts.bigBlind,
        creator:        game.creator,
        timeout:        opts.timeout,
        createdAt:      game.createdAt,
        sngStartTime:   opts.sngStartTime,
    };
};
```

(Leave `convertGameList` at the bottom of the file untouched — it just maps over `convertGameListItemToGameWithFormat`.)

- [ ] **Step 2: Write the failing test for the heuristic**

```ts
// src/utils/selectFeaturedGame.test.ts
import { describe, it, expect } from "vitest";
import { selectFeaturedGame } from "./selectFeaturedGame";
import type { GameWithFormat } from "./convertUtils";

function makeGame(overrides: Partial<GameWithFormat>): GameWithFormat {
    return {
        gameId: "default",
        minBuyIn: "1000000",
        maxBuyIn: "2000000",
        minPlayers: 2,
        maxPlayers: 6,
        currentPlayers: 0,
        gameFormat: "sit-and-go",
        gameVariant: "texas-holdem",
        smallBlind: "10000",
        bigBlind: "20000",
        ...overrides,
    };
}

describe("selectFeaturedGame", () => {
    it("returns null when there are no Sit & Go games", () => {
        const games = [makeGame({ gameId: "a", gameFormat: "cash" })];
        expect(selectFeaturedGame(games)).toBeNull();
    });

    it("returns null for an empty list", () => {
        expect(selectFeaturedGame([])).toBeNull();
    });

    it("picks the Sit & Go with the soonest sngStartTime", () => {
        const soon = makeGame({ gameId: "soon", sngStartTime: 1000 });
        const later = makeGame({ gameId: "later", sngStartTime: 5000 });
        const cash = makeGame({ gameId: "cash", gameFormat: "cash", sngStartTime: 1 });
        expect(selectFeaturedGame([later, soon, cash])?.gameId).toBe("soon");
    });

    it("falls back to the fullest Sit & Go when none have sngStartTime", () => {
        const empty = makeGame({ gameId: "empty", currentPlayers: 0, maxPlayers: 6 });
        const full = makeGame({ gameId: "full", currentPlayers: 5, maxPlayers: 6 });
        expect(selectFeaturedGame([empty, full])?.gameId).toBe("full");
    });

    it("ignores tournament-format games (only sit-and-go counts as featured)", () => {
        const tournament = makeGame({ gameId: "t", gameFormat: "tournament", sngStartTime: 1 });
        expect(selectFeaturedGame([tournament])).toBeNull();
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn vitest run src/utils/selectFeaturedGame.test.ts`
Expected: FAIL — `selectFeaturedGame.ts` doesn't exist yet.

- [ ] **Step 4: Write the implementation**

```ts
// src/utils/selectFeaturedGame.ts
import type { GameWithFormat } from "./convertUtils";

/**
 * Picks the Sit & Go to feature on the Lobby: the soonest-to-start one
 * (lowest sngStartTime), falling back to the fullest Sit & Go when none
 * have a start time set. Tournament format is deliberately excluded — only
 * Sit & Go is "featured" in this version.
 */
export function selectFeaturedGame(games: GameWithFormat[]): GameWithFormat | null {
    const sngGames = games.filter(g => g.gameFormat === "sit-and-go");
    if (sngGames.length === 0) return null;

    const withStartTime = sngGames.filter(g => g.sngStartTime !== undefined);
    if (withStartTime.length > 0) {
        return [...withStartTime].sort((a, b) => a.sngStartTime! - b.sngStartTime!)[0];
    }

    return [...sngGames].sort((a, b) => b.currentPlayers - a.currentPlayers)[0];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn vitest run src/utils/selectFeaturedGame.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 6: Verify baselines**

Run: `yarn tsc --noEmit 2>&1 | grep -c "error TS"` — expect 61 (unchanged — this adds a field and a new file, doesn't touch existing error-producing code).
Run: `yarn lint 2>&1 | tail -5` — expect 26 warnings / 0 errors (unchanged).
Run: `yarn vitest run 2>&1 | tail -10` — expect 118 passed / 11 files (113 from Task 1 + 5 new).

- [ ] **Step 7: Commit**

```bash
git add src/utils/convertUtils.ts src/utils/selectFeaturedGame.ts src/utils/selectFeaturedGame.test.ts
git commit -m "feat: add sngStartTime field and featured-game selection heuristic"
```

---

### Task 3: `FeaturedTable` component

**Files:**
- Create: `src/components/featuredTable/FeaturedTable.tsx`
- Create: `src/components/featuredTable/FeaturedTable.module.css`

**Interfaces:**
- Consumes: `GameWithFormat` type from `../../utils/convertUtils`; `COSMOS_CONSTANTS` from `@block52/poker-vm-sdk` (for `USDC_DECIMALS`, matching the existing `balance.find(...)` micro-to-decimal conversion pattern already used in `Dashboard.tsx`/`TableList.tsx`); `useNavigate` from `react-router-dom`.
- Produces: `FeaturedTable` default export, `React.FC<{ game: GameWithFormat | null }>`. Renders nothing (`null`) when `game` is `null`. Consumed by Task 5 (`Dashboard.tsx`).

- [ ] **Step 1: Create `src/components/featuredTable/FeaturedTable.tsx`**

```tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import type { GameWithFormat } from "../../utils/convertUtils";
import styles from "./FeaturedTable.module.css";

interface FeaturedTableProps {
    game: GameWithFormat | null;
}

function microToUsdc(micro: string): string {
    return (Number(micro) / Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)).toFixed(2);
}

const FeaturedTable: React.FC<FeaturedTableProps> = ({ game }) => {
    const navigate = useNavigate();

    if (!game) return null;

    return (
        <div className={styles.card}>
            <div className={styles.badges}>
                <span className={styles.badgeSng}>SIT &amp; GO</span>
                <span className={styles.badgeStatus}>Starts when full</span>
            </div>
            <h3 className={styles.name}>
                {game.gameId.slice(0, 6)}…{game.gameId.slice(-4)}
            </h3>
            <div className={styles.meta}>
                <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Seats</span>
                    <span className={styles.metaValue}>{game.currentPlayers}/{game.maxPlayers}</span>
                </div>
                <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Buy-in</span>
                    <span className={styles.metaValue}>${microToUsdc(game.minBuyIn)}</span>
                </div>
            </div>
            <button
                className={styles.registerButton}
                onClick={() => navigate(`/table/${game.gameId}`)}
            >
                Register
            </button>
        </div>
    );
};

export default FeaturedTable;
```

- [ ] **Step 2: Create `src/components/featuredTable/FeaturedTable.module.css`**

```css
.card {
    flex: 2;
    background-color: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-family: Inter, system-ui, sans-serif;
}

.badges {
    display: flex;
    gap: 8px;
}

.badgeSng {
    background-color: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
}

.badgeStatus {
    background-color: var(--border);
    color: var(--text-muted);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
}

.name {
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
    margin: 0;
    font-family: monospace;
}

.meta {
    display: flex;
    gap: 24px;
}

.metaItem {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.metaLabel {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.metaValue {
    font-size: 16px;
    font-weight: 700;
    color: var(--text);
}

.registerButton {
    margin-top: 8px;
    align-self: flex-start;
    background: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 999px;
    color: var(--accent-text);
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    padding: 10px 20px;
    transition: opacity 0.15s;
}

.registerButton:hover {
    opacity: 0.85;
}
```

- [ ] **Step 3: Verify baselines**

Run: `yarn tsc --noEmit 2>&1 | grep -c "error TS"` — expect 61 (unchanged — new file, not yet imported anywhere).
Run: `yarn lint 2>&1 | tail -5` — expect 26/0 (unchanged).
Run: `yarn vitest run 2>&1 | tail -10` — expect 118 passed / 11 files (unchanged — no tests added this task, pure presentational component with no existing precedent for component tests in this codebase).

- [ ] **Step 4: Commit**

```bash
git add src/components/featuredTable/FeaturedTable.tsx src/components/featuredTable/FeaturedTable.module.css
git commit -m "feat: add FeaturedTable component"
```

---

### Task 4: `LiveStats` component

**Files:**
- Create: `src/components/liveStats/LiveStats.tsx`
- Create: `src/components/liveStats/LiveStats.module.css`

**Interfaces:**
- Consumes: nothing external beyond its own props.
- Produces: `LiveStats` default export, `React.FC<{ openTables: number; seatedPlayers: number; avgBlockTimeSeconds: number | null }>`. Consumed by Task 5 (`Dashboard.tsx`).

- [ ] **Step 1: Create `src/components/liveStats/LiveStats.tsx`**

```tsx
import React from "react";
import styles from "./LiveStats.module.css";

interface LiveStatsProps {
    openTables: number;
    seatedPlayers: number;
    avgBlockTimeSeconds: number | null;
}

const LiveStats: React.FC<LiveStatsProps> = ({ openTables, seatedPlayers, avgBlockTimeSeconds }) => {
    return (
        <div className={styles.card}>
            <span className={styles.heading}>Live Now</span>
            <div className={styles.row}>
                <div className={styles.stat}>
                    <span className={styles.value}>{openTables}</span>
                    <span className={styles.label}>Open tables</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.value}>{seatedPlayers}</span>
                    <span className={styles.label}>Seated</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.value}>
                        {avgBlockTimeSeconds !== null ? `${avgBlockTimeSeconds.toFixed(1)}s` : "—"}
                    </span>
                    <span className={styles.label}>Avg block</span>
                </div>
            </div>
        </div>
    );
};

export default LiveStats;
```

- [ ] **Step 2: Create `src/components/liveStats/LiveStats.module.css`**

```css
.card {
    flex: 1;
    background-color: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    font-family: Inter, system-ui, sans-serif;
}

.heading {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
}

.row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
}

.stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.value {
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
    font-variant-numeric: tabular-nums;
}

.label {
    font-size: 11px;
    color: var(--text-muted);
}
```

- [ ] **Step 3: Verify baselines**

Run: `yarn tsc --noEmit 2>&1 | grep -c "error TS"` — expect 61 (unchanged).
Run: `yarn lint 2>&1 | tail -5` — expect 26/0 (unchanged).
Run: `yarn vitest run 2>&1 | tail -10` — expect 118 passed / 11 files (unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/components/liveStats/LiveStats.tsx src/components/liveStats/LiveStats.module.css
git commit -m "feat: add LiveStats component"
```

---

### Task 5: Wire `FeaturedTable` + `LiveStats` into Dashboard

**Files:**
- Modify: `src/pages/dashboard/Dashboard.tsx`
- Modify: `src/pages/dashboard/Dashboard.module.css`

**Interfaces:**
- Consumes: `useFindGames` from `../../hooks/useFindGames` (existing), `selectFeaturedGame` from `../../utils/selectFeaturedGame` (Task 2), `useAvgBlockTime` from `../../hooks/useAvgBlockTime` (Task 1), `FeaturedTable` default export (Task 3), `LiveStats` default export (Task 4).

- [ ] **Step 1: Add the new imports and hook calls to `Dashboard.tsx`**

Add these imports alongside the existing ones (after the `TableList` import):

```tsx
import FeaturedTable from "../../components/featuredTable/FeaturedTable";
import LiveStats from "../../components/liveStats/LiveStats";
import { useFindGames } from "../../hooks/useFindGames";
import { useAvgBlockTime } from "../../hooks/useAvgBlockTime";
import { selectFeaturedGame } from "../../utils/selectFeaturedGame";
```

Inside the `Dashboard` component, after the existing `usdcBalanceAmount`/`avatarInitials` consts, add:

```tsx
  const { games } = useFindGames();
  const { avgBlockTimeSeconds } = useAvgBlockTime();
  const featuredGame = selectFeaturedGame(games);
  const seatedPlayers = games.reduce((sum, g) => sum + g.currentPlayers, 0);
```

- [ ] **Step 2: Render the new row above `TableList`**

Current render (`Dashboard.tsx`, inside `<main className={styles.main}>`):

```tsx
        <main className={styles.main}>
          <TableList />
        </main>
```

Change to:

```tsx
        <main className={styles.main}>
          <div className={styles.overviewRow}>
            <FeaturedTable game={featuredGame} />
            <LiveStats
              openTables={games.length}
              seatedPlayers={seatedPlayers}
              avgBlockTimeSeconds={avgBlockTimeSeconds}
            />
          </div>
          <TableList />
        </main>
```

- [ ] **Step 3: Add `.overviewRow` to `Dashboard.module.css`**

Read the current file first (it already has `.page`/`.header`/`.layout`/`.sidebar`/`.main` from earlier work). Add:

```css
.overviewRow {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
}
```

If `FeaturedTable` is absent (`featuredGame` is `null`), `LiveStats`'s own `flex: 1` combined with `FeaturedTable`'s absence means `LiveStats` alone fills the row's available width naturally (no conditional CSS needed — `display: flex` with one child just gives that child the row).

- [ ] **Step 4: Visual verification**

Restart the app (Global Constraints restart command), open Dashboard (`/`). Confirm: if any Sit & Go games exist, `FeaturedTable` renders above the table list with a "Register" button that navigates to that table; `LiveStats` always renders showing open-tables/seated/avg-block numbers (avg block may show "—" briefly before the first poll completes). If no Sit & Go games exist, confirm only `LiveStats` renders and the layout doesn't look broken (no empty gap where `FeaturedTable` would be).

- [ ] **Step 5: Verify baselines**

Run: `yarn tsc --noEmit 2>&1 | grep -c "error TS"` — expect 61 (unchanged).
Run: `yarn lint 2>&1 | tail -5` — expect 26/0 (unchanged).
Run: `yarn vitest run 2>&1 | tail -10` — expect 118 passed / 11 files (unchanged — this task is wiring, no new logic to test).

- [ ] **Step 6: Commit**

```bash
git add src/pages/dashboard/Dashboard.tsx src/pages/dashboard/Dashboard.module.css
git commit -m "feat: wire FeaturedTable and LiveStats into Dashboard"
```

---

### Task 6: TableList filter tabs

**Files:**
- Modify: `src/components/tableList/TableList.tsx`
- Modify: `src/components/tableList/TableList.module.css`

**Interfaces:**
- No new external interfaces — purely internal state/rendering added to an existing component.

- [ ] **Step 1: Add filter-tab state and filtering logic**

In `TableList.tsx`, after the existing `const [search, setSearch] = useState("");` line, add:

```tsx
    const [formatFilter, setFormatFilter] = useState<"all" | "cash" | "sit-and-go">("all");
```

In the `games` `useMemo` (currently starts `let list = rawGames;` and applies the search filter), add the format filter BEFORE the existing search filter:

Current (`TableList.tsx:66-71`):
```tsx
    const games = useMemo(() => {
        let list = rawGames;
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(g => g.gameId.toLowerCase().includes(q));
        }
```

Change to:
```tsx
    const games = useMemo(() => {
        let list = rawGames;
        if (formatFilter !== "all") {
            list = list.filter(g => {
                if (isTournamentFormat(g.gameFormat)) return false;
                const label = String(g.gameFormat).toLowerCase();
                const isSng = label.includes("sng") || label.includes("sit");
                return formatFilter === "sit-and-go" ? isSng : !isSng;
            });
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(g => g.gameId.toLowerCase().includes(q));
        }
```

(This mirrors `badgeClass`'s existing `isTournamentFormat`/`.includes("sng"/"sit")` string-matching convention at `TableList.tsx:25-30`, for consistency — Tournament rows are excluded from both the "cash" and "sit-and-go" buckets, matching the spec's decision not to give Tournament its own tab.)

Update the `useMemo`'s dependency array to include `formatFilter`:
```tsx
    }, [rawGames, search, sortKey, sortDir, formatFilter]);
```

Add count helpers right after the `games` memo (used by the tab labels — counts reflect `rawGames`, not the filtered `games`, so switching tabs doesn't change the other tabs' counts):

```tsx
    const cashCount = useMemo(() => rawGames.filter(g => {
        if (isTournamentFormat(g.gameFormat)) return false;
        const label = String(g.gameFormat).toLowerCase();
        return !(label.includes("sng") || label.includes("sit"));
    }).length, [rawGames]);

    const sngCount = useMemo(() => rawGames.filter(g => {
        if (isTournamentFormat(g.gameFormat)) return false;
        const label = String(g.gameFormat).toLowerCase();
        return label.includes("sng") || label.includes("sit");
    }).length, [rawGames]);
```

- [ ] **Step 2: Render the tabs row**

Current header (`TableList.tsx:131-154`) starts with:
```tsx
            <div className={styles.header}>
                <h2 className={styles.title}>Available Tables</h2>
                <span className={styles.count}>{games.length}</span>
                <div className={styles.spacer} />
```

Add a new tabs row ABOVE the existing `.header` div (as a sibling, not inside it — the mockup shows tabs as their own row above the search/refresh row):

```tsx
            <div className={styles.tabsRow}>
                <button
                    className={formatFilter === "all" ? styles.tabActive : styles.tab}
                    onClick={() => setFormatFilter("all")}
                >
                    All <span className={styles.tabCount}>{rawGames.length}</span>
                </button>
                <button
                    className={formatFilter === "cash" ? styles.tabActive : styles.tab}
                    onClick={() => setFormatFilter("cash")}
                >
                    Cash <span className={styles.tabCount}>{cashCount}</span>
                </button>
                <button
                    className={formatFilter === "sit-and-go" ? styles.tabActive : styles.tab}
                    onClick={() => setFormatFilter("sit-and-go")}
                >
                    Sit &amp; Go <span className={styles.tabCount}>{sngCount}</span>
                </button>
            </div>
            <div className={styles.header}>
                <h2 className={styles.title}>Available Tables</h2>
                <span className={styles.count}>{games.length}</span>
                <div className={styles.spacer} />
```

(The rest of `.header`'s contents — search box, refresh button — stay exactly as they are.)

- [ ] **Step 3: Add tab styles to `TableList.module.css`**

```css
.tabsRow {
    display: flex;
    gap: 8px;
    padding: 16px 20px 0;
}

.tab,
.tabActive {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    padding: 6px 14px;
    transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}

.tab:hover {
    color: var(--text);
    background-color: var(--border);
}

.tabActive {
    color: var(--accent-text);
    background: var(--accent);
    border-color: var(--accent);
}

.tabCount {
    font-size: 11px;
    opacity: 0.8;
}
```

(If `.header`'s existing top padding now double-pads against `.tabsRow`'s own padding, adjust `.header`'s top padding down slightly — a visual judgment call to make while looking at the running app, not a fixed rule.)

- [ ] **Step 4: Visual verification**

Restart the app, open Dashboard. Confirm: three pill tabs render above the search row, each showing a count; clicking a tab filters the visible rows and highlights the active tab; the counts themselves don't change when switching tabs (they reflect the full unfiltered list); combining a tab filter with the search box still works (both filters apply together).

- [ ] **Step 5: Verify baselines**

Run: `yarn tsc --noEmit 2>&1 | grep -c "error TS"` — expect 61 (unchanged).
Run: `yarn lint 2>&1 | tail -5` — expect 26/0 (unchanged).
Run: `yarn vitest run 2>&1 | tail -10` — expect 118 passed / 11 files (unchanged — no new test file; this is simple derived-state filtering on an already-covered-by-manual-verification component, consistent with `TableList.tsx` having no existing unit tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/tableList/TableList.tsx src/components/tableList/TableList.module.css
git commit -m "feat: add format filter tabs to TableList"
```

---

### Task 7: `createGame` action function

**Files:**
- Create: `src/hooks/createGame.ts`
- Test: `src/hooks/createGame.test.ts`

**Interfaces:**
- Consumes: `withMoneyMoverRetry` from `../utils/cosmos/client` (existing), `NetworkEndpoints` type from `../context/NetworkContext` (existing).
- Produces: `createGame(params: CreateGameParams, network: NetworkEndpoints): Promise<string>` (returns the new game's ID), `CreateGameParams` type — both consumed by Task 8 (`CreateTableModal`).

- [ ] **Step 1: Write the failing test**

This function is a thin wrapper around `withMoneyMoverRetry`/the signing client — test that it calls through with the right arguments and returns the game ID, using a mock signing client (matching the existing test style in `src/hooks/playerActions/joinTable.test.ts` — read that file first for the exact mocking pattern used in this codebase before writing this test, since `withMoneyMoverRetry` itself is already covered elsewhere and shouldn't be re-tested here, only this function's own argument-passing).

```ts
// src/hooks/createGame.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGame } from "./createGame";
import * as cosmosClient from "../utils/cosmos/client";
import type { NetworkEndpoints } from "../context/NetworkContext";

const mockNetwork: NetworkEndpoints = {
    name: "Test",
    rpc: "http://localhost:26657",
    rest: "http://localhost:1317",
    grpc: "http://localhost:9090",
    ws: "ws://localhost:26657/ws",
};

describe("createGame", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("calls signingClient.createGame with the given params and returns the game ID", async () => {
        const mockCreateGame = vi.fn().mockResolvedValue("game-abc-123");
        vi.spyOn(cosmosClient, "withMoneyMoverRetry").mockImplementation(
            async (_network, fn) => fn({ signingClient: { createGame: mockCreateGame } } as never)
        );

        const result = await createGame(
            {
                gameFormat: "cash",
                gameVariant: "texas-holdem",
                minPlayers: 2,
                maxPlayers: 6,
                minBuyIn: 1000000n,
                maxBuyIn: 2000000n,
                smallBlind: 10000n,
                bigBlind: 20000n,
                timeout: 30,
            },
            mockNetwork
        );

        expect(result).toBe("game-abc-123");
        expect(mockCreateGame).toHaveBeenCalledWith(
            "cash", "texas-holdem", 2, 6, 1000000n, 2000000n, 10000n, 20000n, 30,
            undefined, undefined, undefined
        );
    });

    it("passes rakeConfig, sngConfig, and name through when provided", async () => {
        const mockCreateGame = vi.fn().mockResolvedValue("game-xyz");
        vi.spyOn(cosmosClient, "withMoneyMoverRetry").mockImplementation(
            async (_network, fn) => fn({ signingClient: { createGame: mockCreateGame } } as never)
        );

        const rakeConfig = { rakeFreeThreshold: 0n, rakePercentage: 5, rakeCap: 500000n, owner: "b52creator" };
        const sngConfig = { startingStack: 5000000n, blindLevelDuration: 600 };

        await createGame(
            {
                gameFormat: "sit-and-go",
                gameVariant: "texas-holdem",
                minPlayers: 6,
                maxPlayers: 6,
                minBuyIn: 1000000n,
                maxBuyIn: 1000000n,
                smallBlind: 10000n,
                bigBlind: 20000n,
                timeout: 30,
                rakeConfig,
                sngConfig,
                name: "Friday Degens",
            },
            mockNetwork
        );

        expect(mockCreateGame).toHaveBeenCalledWith(
            "sit-and-go", "texas-holdem", 6, 6, 1000000n, 1000000n, 10000n, 20000n, 30,
            rakeConfig, sngConfig, "Friday Degens"
        );
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/hooks/createGame.test.ts`
Expected: FAIL — `createGame.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// src/hooks/createGame.ts
import type { NetworkEndpoints } from "../context/NetworkContext";
import { withMoneyMoverRetry } from "../utils/cosmos/client";

export interface RakeConfigParams {
    rakeFreeThreshold: bigint;
    rakePercentage: number;
    rakeCap: bigint;
    owner: string;
}

export interface SngConfigParams {
    startingStack: bigint;
    blindLevelDuration: number;
    entryFee?: bigint;
}

export interface CreateGameParams {
    gameFormat: "cash" | "sit-and-go";
    gameVariant: "texas-holdem" | "omaha";
    minPlayers: number;
    maxPlayers: number;
    minBuyIn: bigint;
    maxBuyIn: bigint;
    smallBlind: bigint;
    bigBlind: bigint;
    timeout: number;
    rakeConfig?: RakeConfigParams;
    sngConfig?: SngConfigParams;
    name?: string;
}

/**
 * Creates a new poker table on-chain. CREATE is a signed, costed
 * transaction like JOIN — retries once on a sequence mismatch caused by a
 * still-pending prior money-mover, matching joinTable's pattern.
 *
 * @returns The new game's ID.
 */
export async function createGame(params: CreateGameParams, network: NetworkEndpoints): Promise<string> {
    return withMoneyMoverRetry(network, ({ signingClient }) =>
        signingClient.createGame(
            params.gameFormat,
            params.gameVariant,
            params.minPlayers,
            params.maxPlayers,
            params.minBuyIn,
            params.maxBuyIn,
            params.smallBlind,
            params.bigBlind,
            params.timeout,
            params.rakeConfig,
            params.sngConfig,
            params.name
        )
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/hooks/createGame.test.ts`
Expected: PASS, 2/2. If `withMoneyMoverRetry`'s exact export shape doesn't allow `vi.spyOn` the way written above (e.g. it's not configured for spying in this codebase's vitest setup), check `src/hooks/playerActions/joinTable.test.ts` for the actual established mocking approach and match it exactly instead — don't guess at a different mocking strategy.

- [ ] **Step 5: Verify baselines**

Run: `yarn tsc --noEmit 2>&1 | grep -c "error TS"` — expect 61 (unchanged).
Run: `yarn lint 2>&1 | tail -5` — expect 26/0 (unchanged).
Run: `yarn vitest run 2>&1 | tail -10` — expect 120 passed / 12 files (118 + 2 new).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/createGame.ts src/hooks/createGame.test.ts
git commit -m "feat: add createGame action function"
```

---

### Task 8: `CreateTableModal` component

**Files:**
- Create: `src/components/modal/CreateTableModal.tsx`
- Create: `src/components/modal/CreateTableModal.module.css`

**Interfaces:**
- Consumes: `createGame`, `CreateGameParams` from `../../hooks/createGame` (Task 7); `parseUsdcToMicro` from `../../utils/currency`; `useNetwork` from `../../context/NetworkContext`; `computeGameNameFee`, `GAME_NAME_MICRO_PER_CHAR`, `MAX_GAME_NAME_LENGTH`, `COSMOS_CONSTANTS` from `@block52/poker-vm-sdk`; `getCosmosAddress` from `../../utils/cosmos/storage`.
- Produces: `CreateTableModal` default export, `React.FC<{ onClose: () => void }>`. Consumed by Task 9 (`TableList.tsx`).

- [ ] **Step 1: Create `src/components/modal/CreateTableModal.tsx`**

Follows `DepositModal.tsx`'s exact structural pattern (overlay/modal/header/close button, field groups, error banner, actions row, a success state branch) — read `src/components/modal/DepositModal.tsx` in full before writing this, to match its conventions exactly rather than inventing a new modal shape.

```tsx
import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { COSMOS_CONSTANTS, computeGameNameFee, MAX_GAME_NAME_LENGTH } from "@block52/poker-vm-sdk";
import { createGame, type CreateGameParams } from "../../hooks/createGame";
import { useNetwork } from "../../context/NetworkContext";
import { parseUsdcToMicro } from "../../utils/currency";
import { getCosmosAddress } from "../../utils/cosmos/storage";
import styles from "./CreateTableModal.module.css";

interface CreateTableModalProps {
    onClose: () => void;
}

type Format = "cash" | "sit-and-go";
type Variant = "texas-holdem" | "omaha";

const PLAYER_COUNT_OPTIONS = [2, 4, 6, 9] as const;

function microToDisplay(micro: bigint): string {
    return (Number(micro) / Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)).toFixed(2);
}

const CreateTableModal: React.FC<CreateTableModalProps> = ({ onClose }) => {
    const navigate = useNavigate();
    const { currentNetwork } = useNetwork();

    const [format, setFormat] = useState<Format>("cash");
    const [variant, setVariant] = useState<Variant>("texas-holdem");
    const [maxPlayers, setMaxPlayers] = useState<number>(6);
    const [minBuyIn, setMinBuyIn] = useState("1");
    const [maxBuyIn, setMaxBuyIn] = useState("2");
    const [smallBlind, setSmallBlind] = useState("0.01");
    const [bigBlind, setBigBlind] = useState("0.02");
    const [timeout, setTimeoutSeconds] = useState("30");

    const [rakeEnabled, setRakeEnabled] = useState(false);
    const [rakeFreeThreshold, setRakeFreeThreshold] = useState("0");
    const [rakePercentage, setRakePercentage] = useState("5");
    const [rakeCap, setRakeCap] = useState("1");

    const [startingStack, setStartingStack] = useState("5");
    const [blindLevelMinutes, setBlindLevelMinutes] = useState("10");
    const [entryFee, setEntryFee] = useState("");

    const [name, setName] = useState("");

    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdGameId, setCreatedGameId] = useState<string | null>(null);

    const nameFeeMicro = useMemo(() => (name ? computeGameNameFee(name) : 0n), [name]);

    const handleOverlayClick = useCallback(
        (e: React.MouseEvent) => {
            if (e.target === e.currentTarget) onClose();
        },
        [onClose]
    );

    const handleSubmit = useCallback(async () => {
        setError("");

        const minPlayers = format === "sit-and-go" ? maxPlayers : 2;

        if (format === "sit-and-go" && (!startingStack || Number(startingStack) <= 0)) {
            setError("Starting stack must be greater than 0 for Sit & Go.");
            return;
        }
        if (format === "sit-and-go" && (!blindLevelMinutes || Number(blindLevelMinutes) <= 0)) {
            setError("Blind level duration must be greater than 0 for Sit & Go.");
            return;
        }

        const creatorAddress = getCosmosAddress();
        if (rakeEnabled && !creatorAddress) {
            setError("No wallet found — cannot set a rake owner.");
            return;
        }

        const params: CreateGameParams = {
            gameFormat: format,
            gameVariant: variant,
            minPlayers,
            maxPlayers,
            minBuyIn: parseUsdcToMicro(minBuyIn),
            maxBuyIn: parseUsdcToMicro(maxBuyIn),
            smallBlind: parseUsdcToMicro(smallBlind),
            bigBlind: parseUsdcToMicro(bigBlind),
            timeout: Number(timeout),
            ...(rakeEnabled && creatorAddress
                ? {
                      rakeConfig: {
                          rakeFreeThreshold: parseUsdcToMicro(rakeFreeThreshold),
                          rakePercentage: Number(rakePercentage),
                          rakeCap: parseUsdcToMicro(rakeCap),
                          owner: creatorAddress,
                      },
                  }
                : {}),
            ...(format === "sit-and-go"
                ? {
                      sngConfig: {
                          startingStack: parseUsdcToMicro(startingStack),
                          blindLevelDuration: Number(blindLevelMinutes) * 60,
                          ...(entryFee ? { entryFee: parseUsdcToMicro(entryFee) } : {}),
                      },
                  }
                : {}),
            ...(name ? { name } : {}),
        };

        setIsSubmitting(true);
        try {
            const gameId = await createGame(params, currentNetwork);
            setCreatedGameId(gameId);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create table");
        } finally {
            setIsSubmitting(false);
        }
    }, [
        format, variant, maxPlayers, minBuyIn, maxBuyIn, smallBlind, bigBlind, timeout,
        rakeEnabled, rakeFreeThreshold, rakePercentage, rakeCap,
        startingStack, blindLevelMinutes, entryFee, name, currentNetwork,
    ]);

    if (createdGameId) {
        return (
            <div className={styles.overlay} onClick={handleOverlayClick}>
                <div className={styles.modal}>
                    <div className={styles.header}>
                        <h2 className={styles.title}>Table Created</h2>
                        <button onClick={onClose} className={styles.closeButton}>
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <p className={styles.doneText}>Your table is live.</p>
                    <div className={styles.hashBox}>
                        <p className={styles.hashLabel}>Table ID</p>
                        <p className={styles.hashValue}>{createdGameId}</p>
                    </div>
                    <button
                        onClick={() => navigate(`/table/${createdGameId}`)}
                        className={`${styles.primaryButton} ${styles.fullWidth}`}
                    >
                        Join now
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.overlay} onClick={handleOverlayClick}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Create Table</h2>
                    <button onClick={onClose} className={styles.closeButton}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.tokenRow}>
                    <button
                        onClick={() => setFormat("cash")}
                        className={format === "cash" ? styles.tokenButtonSelected : styles.tokenButton}
                    >
                        Cash
                    </button>
                    <button
                        onClick={() => setFormat("sit-and-go")}
                        className={format === "sit-and-go" ? styles.tokenButtonSelected : styles.tokenButton}
                    >
                        Sit &amp; Go
                    </button>
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Variant</label>
                    <select
                        value={variant}
                        onChange={e => setVariant(e.target.value as Variant)}
                        className={styles.input}
                    >
                        <option value="texas-holdem">Texas Hold'em</option>
                        <option value="omaha">Omaha</option>
                    </select>
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Max players</label>
                    <select
                        value={maxPlayers}
                        onChange={e => setMaxPlayers(Number(e.target.value))}
                        className={styles.input}
                    >
                        {PLAYER_COUNT_OPTIONS.map(n => (
                            <option key={n} value={n}>{n}-max</option>
                        ))}
                    </select>
                </div>

                <div className={styles.fieldRow}>
                    <div className={styles.field}>
                        <label className={styles.label}>Min buy-in (USDC)</label>
                        <input type="number" min="0" step="0.01" value={minBuyIn}
                            onChange={e => setMinBuyIn(e.target.value)} className={styles.input} />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Max buy-in (USDC)</label>
                        <input type="number" min="0" step="0.01" value={maxBuyIn}
                            onChange={e => setMaxBuyIn(e.target.value)} className={styles.input} />
                    </div>
                </div>

                <div className={styles.fieldRow}>
                    <div className={styles.field}>
                        <label className={styles.label}>Small blind (USDC)</label>
                        <input type="number" min="0" step="0.001" value={smallBlind}
                            onChange={e => setSmallBlind(e.target.value)} className={styles.input} />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Big blind (USDC)</label>
                        <input type="number" min="0" step="0.001" value={bigBlind}
                            onChange={e => setBigBlind(e.target.value)} className={styles.input} />
                    </div>
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Action timeout (seconds)</label>
                    <input type="number" min="5" step="1" value={timeout}
                        onChange={e => setTimeoutSeconds(e.target.value)} className={styles.input} />
                </div>

                {format === "sit-and-go" && (
                    <>
                        <div className={styles.fieldRow}>
                            <div className={styles.field}>
                                <label className={styles.label}>Starting stack (USDC)</label>
                                <input type="number" min="0" step="0.01" value={startingStack}
                                    onChange={e => setStartingStack(e.target.value)} className={styles.input} />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Blind level (minutes)</label>
                                <input type="number" min="1" step="1" value={blindLevelMinutes}
                                    onChange={e => setBlindLevelMinutes(e.target.value)} className={styles.input} />
                            </div>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Entry fee (USDC, optional)</label>
                            <input type="number" min="0" step="0.01" value={entryFee}
                                onChange={e => setEntryFee(e.target.value)} className={styles.input} placeholder="0.00" />
                        </div>
                    </>
                )}

                <div className={styles.field}>
                    <label className={styles.checkboxLabel}>
                        <input type="checkbox" checked={rakeEnabled}
                            onChange={e => setRakeEnabled(e.target.checked)} />
                        Charge rake
                    </label>
                </div>

                {rakeEnabled && (
                    <div className={styles.fieldRow}>
                        <div className={styles.field}>
                            <label className={styles.label}>Free-play threshold (USDC)</label>
                            <input type="number" min="0" step="0.01" value={rakeFreeThreshold}
                                onChange={e => setRakeFreeThreshold(e.target.value)} className={styles.input} />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Rake %</label>
                            <input type="number" min="0" max="100" step="1" value={rakePercentage}
                                onChange={e => setRakePercentage(e.target.value)} className={styles.input} />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Rake cap (USDC)</label>
                            <input type="number" min="0" step="0.01" value={rakeCap}
                                onChange={e => setRakeCap(e.target.value)} className={styles.input} />
                        </div>
                    </div>
                )}

                <div className={styles.field}>
                    <label className={styles.label}>Table name (optional)</label>
                    <input type="text" value={name} maxLength={MAX_GAME_NAME_LENGTH}
                        onChange={e => setName(e.target.value)} className={styles.input}
                        placeholder="Friday Degens" />
                    {name && (
                        <p className={styles.inputHint}>Cost: ${microToDisplay(nameFeeMicro)}</p>
                    )}
                </div>

                {error && <div className={styles.errorBanner}>{error}</div>}

                <div className={styles.actions}>
                    <button onClick={onClose} className={styles.cancelButton}>
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className={styles.primaryButton}>
                        {isSubmitting ? "Creating..." : "Create table"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateTableModal;
```

- [ ] **Step 2: Create `src/components/modal/CreateTableModal.module.css`**

Copy `src/components/modal/DepositModal.module.css`'s full contents as the starting point (it already has every selector this component references: `.overlay`, `.modal`, `.header`, `.title`, `.closeButton`, `.tokenRow`, `.tokenButton`, `.tokenButtonSelected`, `.field`, `.fieldRow` — add this one if `DepositModal.module.css` doesn't already have it, as a simple `display: flex; gap: 12px;` row wrapper, `.label`, `.input`, `.inputHint`, `.errorBanner`, `.actions`, `.primaryButton`, `.cancelButton`, `.fullWidth`, `.doneText`, `.hashBox`, `.hashLabel`, `.hashValue`). Add one new selector not in `DepositModal.module.css`:

```css
.checkboxLabel {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text);
    font-size: 13px;
    cursor: pointer;
}
```

- [ ] **Step 3: Verify baselines**

Run: `yarn tsc --noEmit 2>&1 | grep -c "error TS"` — expect 61 (unchanged — new file, not yet imported).
Run: `yarn lint 2>&1 | tail -5` — expect 26/0 (unchanged).
Run: `yarn vitest run 2>&1 | tail -10` — expect 120 passed / 12 files (unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/components/modal/CreateTableModal.tsx src/components/modal/CreateTableModal.module.css
git commit -m "feat: add CreateTableModal component"
```

---

### Task 9: Wire "+ Create table" button into TableList, final visual pass

**Files:**
- Modify: `src/components/tableList/TableList.tsx`
- Modify: `src/components/tableList/TableList.module.css`

**Interfaces:**
- Consumes: `CreateTableModal` default export (Task 8).

- [ ] **Step 1: Add modal-visibility state and the button**

In `TableList.tsx`, add the import:

```tsx
import CreateTableModal from "../modal/CreateTableModal";
```

Add state near the other `useState` calls:

```tsx
    const [showCreateModal, setShowCreateModal] = useState(false);
```

In the `.tabsRow` div added in Task 6, add a button after the three tab buttons:

```tsx
            <div className={styles.tabsRow}>
                {/* ...existing 3 tab buttons... */}
                <div className={styles.tabsSpacer} />
                <button className={styles.createButton} onClick={() => setShowCreateModal(true)}>
                    + Create table
                </button>
            </div>
```

At the end of the component's returned JSX (as a sibling to the outermost `<div className={styles.container}>`, matching how `Dashboard.tsx` conditionally renders its modals outside the main layout div), add:

```tsx
            {showCreateModal && (
                <CreateTableModal onClose={() => setShowCreateModal(false)} />
            )}
        </div>
    );
};
```

(i.e. the modal renders as a sibling right after `</div>` that closes `.container`, still inside the component's top-level fragment/return — match the exact pattern `Dashboard.tsx` already uses for `SendModal`/`WithdrawModal`/`DepositModal`: `{condition && <Modal onClose={...} />}` directly in the returned JSX, not wrapped in anything extra.)

- [ ] **Step 2: Add `.tabsSpacer` and `.createButton` to `TableList.module.css`**

```css
.tabsSpacer {
    flex: 1;
}

.createButton {
    background: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 999px;
    color: var(--accent-text);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    padding: 6px 14px;
    transition: opacity 0.15s;
}

.createButton:hover {
    opacity: 0.85;
}
```

- [ ] **Step 3: Full restart and whole-feature visual pass**

Restart the app (Global Constraints restart command). Walk through:
- Dashboard: `FeaturedTable` (if a Sit & Go exists) + `LiveStats` render above the table list; filter tabs work; "+ Create table" button opens `CreateTableModal`.
- `CreateTableModal`: fill out a Cash table (minimal fields), submit, confirm the success state shows a table ID and "Join now" navigates to `/table/:id`. Repeat for a Sit & Go table, confirming the extra starting-stack/blind-level fields appear and are required. Toggle rake on/off and confirm the three extra fields appear/disappear. Type a table name and confirm the live fee preview updates.
- Confirm no regressions elsewhere (Wallet, Table page, Sidebar) — this plan touches no files owned by those areas.

- [ ] **Step 4: Final baseline confirmation**

Run: `yarn tsc --noEmit 2>&1 | grep -c "error TS"` — must equal 61.
Run: `yarn lint 2>&1 | tail -5` — must equal 26 warnings / 0 errors.
Run: `yarn vitest run 2>&1 | tail -10` — must show 120 passed / 12 files.

- [ ] **Step 5: Commit**

```bash
git add src/components/tableList/TableList.tsx src/components/tableList/TableList.module.css
git commit -m "feat: wire Create Table button and modal into TableList"
```

---
