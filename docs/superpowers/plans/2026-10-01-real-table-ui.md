# Real Table UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `Table.tsx`'s Plan-2c-era debug page (raw JSON dumps, plain HTML buttons) with the real, designed table UI — felt, seats, action bar, sidebar, and the 5 states (active hand, waiting-for-players, Sit & Go waiting-to-fill, no-wallet, connection-error) — wired to the already-complete hook layer from Plans 2a/2b/2c, with zero changes to that hook layer's own files.

**Architecture:** A new `src/config/seatGeometry.ts` pure module (seat coordinates for 2/4/6/9-max tables, ported from `ui`'s real `stageGeometry.ts`, plus the hero-always-at-bottom rotation formula) feeds a `PlayerSeating` component that renders one `Seat` per position. `TableBoard`/`TableHeader`/`TableSidebar`/`PlayerActionButtons`/`NoWalletOverlay`/`TableErrorPage` are new, focused components under `src/components/table/`, each with its own CSS Module. A global CSS custom-properties file introduces light/dark theming (automatic, via `prefers-color-scheme` — no manual toggle UI yet, there's no Settings page to host one). `Table.tsx` is rewritten to compose all of this and branch across the 5 states, while its existing hook-calling logic (every `useXxx`/`xxxHand` call, the `isSubmitting` guard, `runAction`) carries over unchanged.

**Tech Stack:** React 19, TypeScript, CSS Modules, `vitest`.

**Spec:** `docs/superpowers/specs/2026-10-01-real-table-ui-design.md`

## Global Constraints

- Quotes: always double quotes in `.ts`/`.tsx` (repo CLAUDE.md).
- No `any` type (repo CLAUDE.md).
- No `||`/`??` fallback for SDK values (repo CLAUDE.md).
- Styling: **CSS Modules only** (`Component.module.css` + `import styles from "./Component.module.css"` + `className={styles.foo}`) — matches this codebase's existing convention (`DepositModal.module.css` etc.), not Tailwind/styled-components/inline styles.
- Border-radius is `0` everywhere in app chrome, **except**: the table felt (stadium shape, large/clamped radius), player avatars (`50%`, circular), and pill-shaped badges/nameplates/chips (`999px`) — these three are the spec's deliberate, documented exceptions.
- No new font-loading infrastructure: use the fallback chain `"Barlow Condensed", system-ui, sans-serif` / `Barlow, system-ui, sans-serif` as-is. Desktop has no existing `<link>`/`@font-face` font loading (confirmed by reading `index.html`/`index.css`), and none is added by this plan — if `Barlow`/`Barlow Condensed` aren't installed as system fonts, the design degrades gracefully to `system-ui`, which is an acceptable tradeoff for this plan's scope.
- No manual light/dark toggle UI: theming is automatic via `@media (prefers-color-scheme: dark)` only. A manual override belongs on a Settings page, which doesn't exist yet in this codebase — out of scope here.
- Avatar fill color is a **single, consistent accent-adjacent color**, not per-seat-varied — no requirement was given for player-color differentiation, and varying it would be an unrequested embellishment. The active/"you" seat is already visually distinct via its accent outline and the "Turn"/name treatment.
- No behavior change to any already-merged file from Plans 2a/2b/2c: `GameStateContext.tsx`, `GameMessageBus.ts`, `client.ts`, `transportAction.ts`, `usePlayerLegalActions.ts`, and every existing action hook file (`betHand.ts` etc.) are **not touched** by this plan. `Table.tsx`'s existing hook-calling logic (the exact calls to `useAutoPostBlinds`/`useAutoDeal`/`useAutoNewHand`/`runAction`/`isSubmitting`) must be preserved verbatim — only its JSX/markup changes.
- The 4 layout bugs documented in the spec (header/seat overlap, left/right horizontal bleed, bottom-row misalignment, avatar-height-skew from a variable-height seat box) must not regress. Each task below that touches positioning states which of these it's responsible for.
- No automated tests for any React component in this plan (matches this codebase's zero existing component-test convention) — only `src/config/seatGeometry.ts` (pure functions) gets tests, per the spec's explicit TDD-candidate call-out.

---

### Task 1: Theme tokens (light + dark)

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties (`--text`, `--text-muted`, `--border`, `--border-strong`, `--accent`, `--accent-text`, `--danger`, `--bg-app`, `--bg-card`) on `:root`, with a dark override under `@media (prefers-color-scheme: dark)` — consumed by every CSS Module written in later tasks.

The current `src/index.css` is:

```css
*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial,
    sans-serif;
}
```

- [ ] **Step 1: Add the token block**

Replace the full contents of `src/index.css` with:

```css
:root {
  --text: #1d1f20;
  --text-muted: rgba(29, 31, 32, 0.6);
  --border: rgba(29, 31, 32, 0.16);
  --border-strong: rgba(29, 31, 32, 0.32);
  --accent: #5980a6;
  --accent-text: #f2f2f3;
  --danger: #b3503f;
  --bg-app: #f2f2f3;
  --bg-card: #ffffff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --text: #eceded;
    --text-muted: rgba(236, 237, 237, 0.6);
    --border: rgba(236, 237, 237, 0.14);
    --border-strong: rgba(236, 237, 237, 0.28);
    --accent: #7fa6cc;
    --accent-text: #14181a;
    --danger: #d97c6c;
    --bg-app: #17191b;
    --bg-card: #1f2224;
  }
}

*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family: Barlow, system-ui, sans-serif;
  background: var(--bg-app);
  color: var(--text);
}
```

(The body's font-family changes from the previous system-font stack to the `Barlow` fallback chain, per the spec's design system — this is a deliberate, documented change, not an oversight. `background`/`color` on `body` are new, giving the whole app a theme-aware base instead of unstyled default white/black.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as on `main` before this change (CSS-only change, no TS impact).

Run: `npx eslint --ext .ts,.tsx src` (scoped to `src`, from this worktree root — not bare `yarn lint`/`eslint .` from a location with a sibling `.worktrees/` directory, which double-counts)
Expected: same baseline as before this task (CSS files aren't linted by this command).

Run: `npx vitest run`
Expected: all existing tests still pass (no test touches CSS).

Run: `yarn start`, confirm the app boots with no console errors, and that the background/text color visibly changed from pure white/black to the new off-white/near-black tokens (toggle your OS's dark mode to confirm the `@media` block takes effect — on macOS: System Settings → Appearance).

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add light/dark theme tokens"
```

---

### Task 2: Seat geometry module

**Files:**
- Create: `src/config/seatGeometry.ts`
- Test: `src/config/seatGeometry.test.ts`

**Interfaces:**
- Consumes: nothing (pure module, no SDK/React dependency — deliberately decoupled).
- Produces: `TableSize` (`2 | 4 | 6 | 9`), `resolveTableSize(maxPlayers: number): TableSize`, `getSeatPercent(tableSize: TableSize, uiPosition: number): { left: number; top: number }`, `seatToUiPosition(serverSeat: number, heroServerSeat: number, tableSize: TableSize): number` — all consumed by Task 4 (`PlayerSeating`).

- [ ] **Step 1: Write the failing tests**

Create `src/config/seatGeometry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getSeatPercent, resolveTableSize, seatToUiPosition } from "./seatGeometry";

describe("resolveTableSize", () => {
    it("returns 2 for heads-up", () => {
        expect(resolveTableSize(2)).toBe(2);
    });

    it("returns 4 for a 3-max table (rounds up to the nearest supported size)", () => {
        expect(resolveTableSize(3)).toBe(4);
    });

    it("returns 4 exactly", () => {
        expect(resolveTableSize(4)).toBe(4);
    });

    it("returns 6 for a 5-max table", () => {
        expect(resolveTableSize(5)).toBe(6);
    });

    it("returns 9 for anything above 6", () => {
        expect(resolveTableSize(7)).toBe(9);
        expect(resolveTableSize(9)).toBe(9);
    });
});

describe("getSeatPercent", () => {
    it("places heads-up seats at top/bottom center", () => {
        expect(getSeatPercent(2, 0)).toEqual({ left: 50, top: 90 });
        expect(getSeatPercent(2, 1)).toEqual({ left: 50, top: 14 });
    });

    it("places 4-max seats in a diamond (bottom/left/top/right)", () => {
        expect(getSeatPercent(4, 0)).toEqual({ left: 50, top: 90 });
        expect(getSeatPercent(4, 1)).toEqual({ left: 0, top: 52 });
        expect(getSeatPercent(4, 2)).toEqual({ left: 50, top: 14 });
        expect(getSeatPercent(4, 3)).toEqual({ left: 100, top: 52 });
    });

    it("places 6-max seats symmetrically on both sides", () => {
        const left = getSeatPercent(6, 1);
        const right = getSeatPercent(6, 5);
        expect(left.top).toBe(right.top);
        expect(left.left).toBe(0);
        expect(right.left).toBe(100);
    });

    it("9-max: the bottom-row trio (indices 0, 1, 8) share an identical top value", () => {
        const hero = getSeatPercent(9, 0);
        const left = getSeatPercent(9, 1);
        const right = getSeatPercent(9, 8);
        expect(hero.top).toBe(left.top);
        expect(left.top).toBe(right.top);
    });

    it("9-max: the top-row pair (indices 4, 5) share an identical top value", () => {
        const left = getSeatPercent(9, 4);
        const right = getSeatPercent(9, 5);
        expect(left.top).toBe(right.top);
        expect(left.top).toBe(14);
    });

    it("9-max: the bottom-row trio is NOT at the compressed-range maximum (there's clearance below them)", () => {
        const hero = getSeatPercent(9, 0);
        expect(hero.top).toBeLessThan(90);
    });

    it("compresses the vertical range into [14, 90], never touching the raw [0, 100] extremes", () => {
        for (const size of [2, 4, 6, 9] as const) {
            for (let i = 0; i < size; i++) {
                const { top } = getSeatPercent(size, i);
                expect(top).toBeGreaterThanOrEqual(14);
                expect(top).toBeLessThanOrEqual(90);
            }
        }
    });
});

describe("seatToUiPosition", () => {
    it("places the hero at UI position 0 regardless of their real server seat", () => {
        expect(seatToUiPosition(1, 1, 9)).toBe(0);
        expect(seatToUiPosition(5, 5, 9)).toBe(0);
        expect(seatToUiPosition(9, 9, 9)).toBe(0);
    });

    it("places the next server seat at UI position 1, wrapping forward from the hero", () => {
        expect(seatToUiPosition(2, 1, 9)).toBe(1);
        expect(seatToUiPosition(6, 5, 9)).toBe(1);
    });

    it("wraps correctly when the other seat's number is lower than the hero's", () => {
        // Hero at server seat 5 of 9; seat 1 is 4 seats *before* hero going
        // forward, i.e. 5 seats after wrapping around — position 5.
        expect(seatToUiPosition(1, 5, 9)).toBe(5);
    });

    it("wraps correctly at the table-size boundary", () => {
        // Hero at seat 9 of 9; seat 1 is the very next seat going forward.
        expect(seatToUiPosition(1, 9, 9)).toBe(1);
    });

    it("works for smaller table sizes", () => {
        expect(seatToUiPosition(1, 1, 2)).toBe(0);
        expect(seatToUiPosition(2, 1, 2)).toBe(1);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/config/seatGeometry.test.ts`
Expected: FAIL — `./seatGeometry` does not exist yet.

- [ ] **Step 3: Implement `seatGeometry.ts`**

Create `src/config/seatGeometry.ts`:

```ts
/**
 * Seat positioning for the table felt — table size, seat coordinates, and
 * the "hero always at the bottom" rotation. Ported from ui's real
 * src/config/stageGeometry.ts (SEAT_COORDS, converted from absolute stage
 * pixels to percentages of each table size's own bounding box) and its
 * Table.tsx rotation formula (seatNumber = ((uiPosition + startIndex) %
 * tableSize) + 1) — algebraically inverted here into a direct seat→position
 * lookup, since a renderer iterating its own players list needs "where does
 * this server seat render" rather than ui's "which server seat is at this
 * render position."
 *
 * Deliberately does NOT port ui's SEAT_SPREAD/COMPONENT_SCALE/chip-distance/
 * dealer-distance tuning, viewport zoom/fit, or mobile rotation — none of
 * that applies to this simpler, non-choreographed, fixed-window-class
 * design. Only the seat coordinates and the rotation formula are real,
 * reusable logic; everything else in ui's stageGeometry.ts is visual
 * tuning for a different rendering approach.
 */

export type TableSize = 2 | 4 | 6 | 9;

/**
 * Pick the smallest supported table size that fits maxPlayers. There is no
 * supported layout for, say, a 3-max or 5-max table — round up to the
 * nearest size this module has coordinates for.
 */
export function resolveTableSize(maxPlayers: number): TableSize {
    if (maxPlayers <= 2) return 2;
    if (maxPlayers <= 4) return 4;
    if (maxPlayers <= 6) return 6;
    return 9;
}

/**
 * Raw seat coordinates as percentages of each table size's own bounding
 * box (0-100 range), before the vertical-safe-zone compression below.
 * Converted from ui's stageGeometry.ts SEAT_COORDS (absolute 1600x850
 * stage pixels) by normalizing each table size's own coordinate set
 * against its own min/max — NOT ui's SEAT_SPREAD-adjusted values.
 */
const SEAT_PERCENT_RAW: Record<TableSize, Array<{ left: number; top: number }>> = {
    2: [
        { left: 50, top: 100 },
        { left: 50, top: 0 },
    ],
    4: [
        { left: 50, top: 100 },
        { left: 0, top: 50 },
        { left: 50, top: 0 },
        { left: 100, top: 50 },
    ],
    6: [
        { left: 50, top: 100 },
        { left: 0, top: 75 },
        { left: 0, top: 25 },
        { left: 50, top: 0 },
        { left: 100, top: 25 },
        { left: 100, top: 75 },
    ],
    9: [
        { left: 50, top: 100 },
        { left: 27.7, top: 98.3 },
        { left: 0, top: 66.0 },
        { left: 8.75, top: 11.5 },
        { left: 38.1, top: 0 },
        { left: 61.9, top: 0 },
        { left: 91.25, top: 11.5 },
        { left: 100, top: 66.0 },
        { left: 72.3, top: 98.3 },
    ],
};

// Compresses the raw [0,100] vertical range into [14,90], leaving room
// above for the table header and below for the action bar — without this,
// top-row seats overlap the header and bottom-row seats crowd the action
// bar (a real bug found during this design's visual iteration).
const SAFE_TOP_MIN = 14;
const SAFE_TOP_MAX = 90;

function compressTop(rawTop: number): number {
    return SAFE_TOP_MIN + (rawTop / 100) * (SAFE_TOP_MAX - SAFE_TOP_MIN);
}

/**
 * Final left/top percentages for a seat at the given UI position (0-indexed,
 * 0 = hero/bottom-center) on a table of the given size.
 *
 * For the 9-max layout specifically: ui's own source coordinates give the
 * hero seat (index 0) a top of 100 while its two bottom-row neighbors
 * (indices 1 and 8) sit at 98.3 — a subtle, intentional 10px offset in
 * ui's own larger, more complex rendering context. At this design's
 * smaller scale that offset reads as a misalignment bug, not a deliberate
 * choice (confirmed directly by the user during visual review) — so this
 * function forces all three bottom-row seats to the same raw top (98.3)
 * before compression, rather than trusting ui's source data as-is.
 */
export function getSeatPercent(tableSize: TableSize, uiPosition: number): { left: number; top: number } {
    const raw = SEAT_PERCENT_RAW[tableSize][uiPosition];
    const rawTop = tableSize === 9 && (uiPosition === 0 || uiPosition === 1 || uiPosition === 8) ? 98.3 : raw.top;
    return { left: raw.left, top: compressTop(rawTop) };
}

/**
 * Which UI position (0-indexed, 0 = bottom-center) a player at the given
 * real server seat should render at, given the local hero's own real
 * server seat — so the hero always renders at position 0 regardless of
 * their actual assigned seat number.
 *
 * Ported from ui's Table.tsx rotation: `seatNumber = ((uiPosition +
 * startIndex) % tableSize) + 1`, where `startIndex` is set so the hero's
 * own seat maps to uiPosition 0. Solving that forward formula for
 * `startIndex` gives `startIndex = heroServerSeat - 1`; substituting back
 * and inverting for uiPosition (given a server seat, not given a UI
 * position) yields the direct lookup below — the same rotation, expressed
 * for the direction this renderer actually needs.
 */
export function seatToUiPosition(serverSeat: number, heroServerSeat: number, tableSize: TableSize): number {
    return ((serverSeat - heroServerSeat) % tableSize + tableSize) % tableSize;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/config/seatGeometry.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Verify no regressions**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as after Task 1.

Run: `npx eslint --ext .ts,.tsx src` (scoped)
Expected: same baseline.

Run: `npx vitest run`
Expected: all tests pass (pre-existing plus this task's new tests).

- [ ] **Step 6: Commit**

```bash
git add src/config/seatGeometry.ts src/config/seatGeometry.test.ts
git commit -m "feat: add seat geometry module (table-size coordinates + hero rotation)"
```

---

### Task 3: `Seat` component

**Files:**
- Create: `src/components/table/Seat.tsx`
- Create: `src/components/table/Seat.module.css`

**Interfaces:**
- Consumes: theme tokens from Task 1 (referenced via `var(--token)` in the CSS Module).
- Produces: `SeatProps` and the `Seat` component — consumed by Task 4 (`PlayerSeating`).

This task is responsible for not regressing the **avatar-height-skew bug**: a seat showing a bet chip has a taller box than one without, so the seat's own `transform` must anchor on the avatar's fixed half-height, not the box's own (variable) half-height.

- [ ] **Step 1: Create `Seat.tsx`**

```tsx
import React from "react";
import styles from "./Seat.module.css";

export interface SeatProps {
    /** Left/top position as percentages, from seatGeometry's getSeatPercent(). */
    left: number;
    top: number;
    occupied: boolean;
    /** It's this seat's turn to act. */
    isActive?: boolean;
    isSmallBlind?: boolean;
    isBigBlind?: boolean;
    isDealer?: boolean;
    /** Required when occupied. */
    name?: string;
    stack?: string;
    /** Current-round bet amount to display as a chip below the hole cards. Omit for no bet. */
    currentBet?: string;
    /** Whether to show face-down hole card placeholders (occupied, active-hand seats). */
    showCards?: boolean;
}

function SeatBadge({ isActive, isSmallBlind, isBigBlind, isDealer }: Pick<SeatProps, "isActive" | "isSmallBlind" | "isBigBlind" | "isDealer">) {
    if (isActive) {
        return <span className={styles.badge}>Turn</span>;
    }
    if (isSmallBlind) {
        return <span className={styles.badge}>SB</span>;
    }
    if (isBigBlind) {
        return <span className={styles.badge}>BB</span>;
    }
    if (isDealer) {
        return <span className={`${styles.badge} ${styles.badgeDealer}`}>D</span>;
    }
    return null;
}

export const Seat: React.FC<SeatProps> = ({
    left,
    top,
    occupied,
    isActive,
    isSmallBlind,
    isBigBlind,
    isDealer,
    name,
    stack,
    currentBet,
    showCards,
}) => {
    const style: React.CSSProperties = { left: `${left}%`, top: `${top}%` };

    if (!occupied) {
        return (
            <div className={`${styles.seat} ${styles.vacant}`} style={style}>
                <div className={styles.avatar}>
                    <span className={styles.plus}>+</span>
                </div>
                <div className={styles.nameplate}>
                    <div className={styles.name}>Empty</div>
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.seat} ${isActive ? styles.active : ""}`} style={style}>
            <SeatBadge isActive={isActive} isSmallBlind={isSmallBlind} isBigBlind={isBigBlind} isDealer={isDealer} />
            <div className={styles.avatar}>
                <svg className={styles.avatarIcon} viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                </svg>
            </div>
            <div className={styles.nameplate}>
                <div className={styles.name}>{name}</div>
                <div className={styles.stack}>{stack}</div>
            </div>
            {showCards && (
                <div className={styles.cards}>
                    <div className={styles.miniCard} />
                    <div className={styles.miniCard} />
                </div>
            )}
            {currentBet && <div className={styles.bet}>{currentBet}</div>}
        </div>
    );
};

export default Seat;
```

- [ ] **Step 2: Create `Seat.module.css`**

```css
.seat {
    position: absolute;
    width: 78px;
    /* Anchor on the avatar's own fixed half-height (44px / 2 = 22px), not
       the seat box's own total height. The box's height varies — a bet
       chip or hole cards add height below the avatar — so translateY(-50%)
       would center the WHOLE variable-height box, pushing taller seats'
       avatars higher than shorter ones at the identical nominal row. The
       avatar is always the first element in this top-aligned flex column
       regardless of what renders below it, so a fixed -22px consistently
       keeps the avatar itself pinned to the seat's coordinate. Do not
       change this to -50% and do not add any element ABOVE the avatar in
       this flex column without revisiting this value. */
    transform: translate(-50%, -22px);
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid var(--bg-card);
    outline: 2px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
}

.avatarIcon {
    width: 26px;
    height: 26px;
    color: var(--accent-text);
}

.seat.active .avatar,
.active .avatar {
    outline: 2px solid var(--accent);
}

.badge {
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    font-family: "Barlow Condensed", system-ui, sans-serif;
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.3px;
    text-transform: uppercase;
    color: var(--accent-text);
    background: var(--accent);
    border-radius: 999px;
    padding: 1px 6px;
    white-space: nowrap;
    z-index: 4;
}

.badgeDealer {
    color: var(--text);
    background: var(--bg-app);
    border: 1px solid var(--border-strong);
}

.nameplate {
    margin-top: -6px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 3px 10px 2px;
    text-align: center;
    max-width: 100%;
}

.name {
    font-family: Barlow, system-ui, sans-serif;
    font-size: 9.5px;
    font-weight: 600;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.stack {
    font-family: "Barlow Condensed", system-ui, sans-serif;
    font-size: 11.5px;
    font-weight: 600;
    line-height: 1.2;
}

.cards {
    display: flex;
    gap: 2px;
    margin-top: 4px;
}

.miniCard {
    width: 12px;
    height: 16px;
    background: var(--bg-app);
    border: 1px solid var(--border-strong);
    border-radius: 2px;
}

.bet {
    margin-top: 4px;
    font-family: Barlow, system-ui, sans-serif;
    font-size: 9px;
    color: var(--text-muted);
    white-space: nowrap;
    background: var(--bg-app);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 1px 7px;
}

.vacant .avatar {
    background: transparent;
    border-style: dashed;
    border-color: var(--border-strong);
    outline: none;
}

.plus {
    font-size: 18px;
    color: var(--text-muted);
}

.vacant .nameplate {
    border-style: dashed;
    color: var(--text-muted);
}

.vacant .name {
    color: var(--text-muted);
    font-size: 9.5px;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as after Task 2.

Run: `npx eslint --ext .ts,.tsx src` (scoped)
Expected: same baseline.

Run: `npx vitest run`
Expected: all tests still pass (this task adds no new tests — `Seat` is a React component, not pure logic; matches this codebase's zero-component-test convention).

- [ ] **Step 4: Commit**

```bash
git add src/components/table/Seat.tsx src/components/table/Seat.module.css
git commit -m "feat: add Seat component"
```

---

### Task 4: `PlayerSeating` component

**Files:**
- Create: `src/components/table/PlayerSeating.tsx`
- Create: `src/components/table/PlayerSeating.module.css`

**Interfaces:**
- Consumes: `TableSize`, `resolveTableSize`, `getSeatPercent`, `seatToUiPosition` from `../../config/seatGeometry` (Task 2); `Seat`/`SeatProps` from `./Seat` (Task 3); `PlayerDTO`, `PlayerStatus` from `@block52/poker-vm-sdk`.
- Produces: `PlayerSeatingProps` and the `PlayerSeating` component — consumed by Task 9 (`Table.tsx`).

This task is responsible for not regressing the **left/right horizontal bleed bug**: the outer container must have horizontal padding of at least half a seat's own rendered width (39px for the 78px-wide `Seat`), since the leftmost/rightmost seats (`left: 0%`/`left: 100%`) are horizontally centered on that exact coordinate via `Seat`'s own `translateX(-50%)`.

- [ ] **Step 1: Create `PlayerSeating.tsx`**

```tsx
import React from "react";
import type { PlayerDTO } from "@block52/poker-vm-sdk";
import { getSeatPercent, resolveTableSize, seatToUiPosition } from "../../config/seatGeometry";
import { Seat } from "./Seat";
import styles from "./PlayerSeating.module.css";

export interface PlayerSeatingProps {
    players: PlayerDTO[];
    maxPlayers: number;
    /** The local player's own address (lowercased), to resolve their seat for the hero-rotation. */
    localAddress: string | null;
    nextToAct: number;
    smallBlindPosition?: number;
    bigBlindPosition?: number;
    dealer?: number;
    formatStack: (stack: string) => string;
}

export const PlayerSeating: React.FC<PlayerSeatingProps> = ({
    players,
    maxPlayers,
    localAddress,
    nextToAct,
    smallBlindPosition,
    bigBlindPosition,
    dealer,
    formatStack,
}) => {
    const tableSize = resolveTableSize(maxPlayers);

    // The hero's own seat anchors the rotation. If the local player isn't
    // seated (spectating, or hasn't joined yet), fall back to no rotation
    // (seat 1 renders at position 0) rather than guessing.
    const localPlayer = localAddress ? players.find(p => p.address.toLowerCase() === localAddress) : undefined;
    const heroServerSeat = localPlayer?.seat ?? 1;

    const playersBySeat = new Map<number, PlayerDTO>();
    for (const player of players) {
        playersBySeat.set(player.seat, player);
    }

    const seats = [];
    for (let serverSeat = 1; serverSeat <= tableSize; serverSeat++) {
        const uiPosition = seatToUiPosition(serverSeat, heroServerSeat, tableSize);
        const { left, top } = getSeatPercent(tableSize, uiPosition);
        const player = playersBySeat.get(serverSeat);

        if (!player) {
            seats.push(<Seat key={serverSeat} left={left} top={top} occupied={false} />);
            continue;
        }

        seats.push(
            <Seat
                key={serverSeat}
                left={left}
                top={top}
                occupied={true}
                isActive={nextToAct === serverSeat}
                isSmallBlind={player.isSmallBlind || smallBlindPosition === serverSeat}
                isBigBlind={player.isBigBlind || bigBlindPosition === serverSeat}
                isDealer={player.isDealer || dealer === serverSeat}
                name={player.address}
                stack={formatStack(player.stack)}
                currentBet={player.sumOfBets !== "0" ? formatStack(player.sumOfBets) : undefined}
                showCards={true}
            />
        );
    }

    return <div className={styles.plane}>{seats}</div>;
};

export default PlayerSeating;
```

- [ ] **Step 2: Create `PlayerSeating.module.css`**

```css
.plane {
    position: relative;
    flex: 1;
    /* Horizontal padding must be >= half of Seat's own width (78px / 2 =
       39px) so the leftmost/rightmost seats (left: 0% / left: 100%) don't
       bleed past this container's own edge — their own translateX(-50%)
       extends half their width past the literal coordinate. 46px clears
       it with a small margin. */
    padding: 22px 46px;
    min-height: 420px;
    display: flex;
    align-items: center;
    justify-content: center;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as after Task 3.

Run: `npx eslint --ext .ts,.tsx src` (scoped)
Expected: same baseline.

Run: `npx vitest run`
Expected: all tests still pass (no new tests — React component).

- [ ] **Step 4: Commit**

```bash
git add src/components/table/PlayerSeating.tsx src/components/table/PlayerSeating.module.css
git commit -m "feat: add PlayerSeating component"
```

---

### Task 5: `TableBoard` component

**Files:**
- Create: `src/components/table/TableBoard.tsx`
- Create: `src/components/table/TableBoard.module.css`

**Interfaces:**
- Consumes: `PlayerSeating` (Task 4), `GameFormat`, `TexasHoldemRound`, `isSitAndGoFormat` from `@block52/poker-vm-sdk`.
- Produces: `TableBoardProps` and the `TableBoard` component — consumed by Task 9 (`Table.tsx`).

This task owns the **felt/stadium shape** (deliberate border-radius exception) and the three board-center variants: normal (pot + community cards), Sit & Go waiting-to-fill (prize pool + fill count, pot hidden), and cash-waiting-for-players (seat-fill message, no pot).

- [ ] **Step 1: Create `TableBoard.tsx`**

```tsx
import React from "react";
import type { PlayerDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { PlayerSeating, type PlayerSeatingProps } from "./PlayerSeating";
import styles from "./TableBoard.module.css";

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export interface TableBoardProps extends Omit<PlayerSeatingProps, "players"> {
    players: PlayerDTO[];
    /** Community cards as display strings, e.g. "K♠" — empty for preflop/not dealt yet. */
    communityCards: string[];
    pot: string;
    round: TexasHoldemRound;
    /** When set, replaces the normal pot/cards display with a Sit & Go fill-progress message. */
    sitAndGoWaiting?: { prizePool: string; seated: number; maxPlayers: number };
    /** When set (and sitAndGoWaiting is not), shows a cash-table waiting message instead of pot/cards. */
    waitingForPlayers?: { seated: number; minPlayers: number; maxPlayers: number };
}

export const TableBoard: React.FC<TableBoardProps> = ({
    communityCards,
    pot,
    round,
    sitAndGoWaiting,
    waitingForPlayers,
    ...seatingProps
}) => {
    return (
        <div className={styles.outer}>
            <div className={styles.rail} />
            <div className={styles.felt} />

            {sitAndGoWaiting ? (
                <div className={styles.centerMessage}>
                    <div className={styles.label}>Prize pool</div>
                    <div className={styles.value}>{sitAndGoWaiting.prizePool}</div>
                    <div className={styles.sub}>
                        {sitAndGoWaiting.seated} / {sitAndGoWaiting.maxPlayers} joined — starts automatically when full
                    </div>
                </div>
            ) : waitingForPlayers ? (
                <div className={styles.centerMessage}>
                    <div className={styles.label}>Waiting for players</div>
                    <div className={styles.value}>
                        {waitingForPlayers.seated} / {waitingForPlayers.maxPlayers} seated
                    </div>
                    <div className={styles.sub}>Hand starts automatically once {waitingForPlayers.minPlayers}+ players are ready</div>
                </div>
            ) : (
                <div className={styles.centerMessage}>
                    <div className={styles.label}>Pot</div>
                    <div className={styles.value}>{pot}</div>
                    {communityCards.length > 0 && (
                        <div className={styles.communityCards}>
                            {communityCards.map((card, i) => (
                                <div key={i} className={styles.card}>
                                    {card}
                                </div>
                            ))}
                        </div>
                    )}
                    <div className={styles.roundLabel}>{capitalize(round)}</div>
                </div>
            )}

            <PlayerSeating {...seatingProps} />
        </div>
    );
};

export default TableBoard;
```

- [ ] **Step 2: Create `TableBoard.module.css`**

```css
.outer {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 420px;
}

.rail {
    position: absolute;
    inset: 0;
    border: 8px solid var(--border);
    border-radius: 9999px;
    opacity: 0.5;
}

/* Stadium shape — flat sides, semicircular rounded ends. A fixed radius
   larger than half the box's short side gets clamped by the browser to
   exactly that, producing a true stadium (not a smooth ellipse) — the
   same technique ui's own `rounded-[250px]` on a fixed 1000x500 box
   produces, expressed responsively here instead of with a fixed px value.
   This is the spec's one deliberate border-radius exception besides
   avatars/pills. */
.felt {
    position: absolute;
    inset: 20% 8%;
    background: var(--bg-card);
    border: 2px solid var(--border-strong);
    border-radius: 9999px;
}

.centerMessage {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    z-index: 2;
}

.label {
    font-family: Barlow, system-ui, sans-serif;
    font-size: 10px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 4px;
}

.value {
    font-family: "Barlow Condensed", system-ui, sans-serif;
    font-size: 22px;
    font-weight: 600;
    margin-bottom: 4px;
}

.sub {
    font-family: Barlow, system-ui, sans-serif;
    font-size: 11px;
    color: var(--text-muted);
}

.communityCards {
    display: flex;
    gap: 6px;
    justify-content: center;
    margin: 12px 0 8px;
}

.card {
    width: 40px;
    height: 55px;
    background: var(--bg-card);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "Barlow Condensed", system-ui, sans-serif;
    font-size: 16px;
    font-weight: 600;
}

.roundLabel {
    font-family: Barlow, system-ui, sans-serif;
    font-size: 9px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-top: 6px;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as after Task 4.

Run: `npx eslint --ext .ts,.tsx src` (scoped)
Expected: same baseline.

Run: `npx vitest run`
Expected: all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/table/TableBoard.tsx src/components/table/TableBoard.module.css
git commit -m "feat: add TableBoard component"
```

---

### Task 6: `TableHeader` + `TableSidebar` components

**Files:**
- Create: `src/components/table/TableHeader.tsx`
- Create: `src/components/table/TableHeader.module.css`
- Create: `src/components/table/TableSidebar.tsx`
- Create: `src/components/table/TableSidebar.module.css`

**Interfaces:**
- Consumes: `LegalActionDTO` from `@block52/poker-vm-sdk`.
- Produces: `TableHeaderProps`/`TableHeader`, `TableSidebarProps`/`TableSidebar` — both consumed by Task 9 (`Table.tsx`).

**Ruling on hand history:** `useGameState()`/the current hook layer expose no hand-history data source (no past-hands list exists anywhere in the already-merged code). `TableSidebar`'s hand-history panel therefore shows a static "No hands played yet this session" placeholder — it does **not** fabricate fake history data. Wiring real hand history is out of scope for this plan (would require a new data source, not just a new component).

- [ ] **Step 1: Create `TableHeader.tsx`**

```tsx
import React from "react";
import type { TexasHoldemRound } from "@block52/poker-vm-sdk";
import styles from "./TableHeader.module.css";

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export interface TableHeaderProps {
    tableLabel: string;
    smallBlind: string;
    bigBlind: string;
    handNumber: number;
    round: TexasHoldemRound;
    playerCount: number;
    maxPlayers: number;
    onLeave: () => void;
    leaveDisabled: boolean;
}

export const TableHeader: React.FC<TableHeaderProps> = ({
    tableLabel,
    smallBlind,
    bigBlind,
    handNumber,
    round,
    playerCount,
    maxPlayers,
    onLeave,
    leaveDisabled,
}) => {
    return (
        <div className={styles.header}>
            <div className={styles.club}>{tableLabel}</div>
            <div className={styles.meta}>
                <div className={styles.metaItem}>
                    <div className={styles.label}>Blinds</div>
                    <div className={styles.value}>
                        {smallBlind} / {bigBlind}
                    </div>
                </div>
                <div className={styles.metaItem}>
                    <div className={styles.label}>Hand</div>
                    <div className={styles.value}>#{handNumber}</div>
                </div>
                <div className={styles.metaItem}>
                    <div className={styles.label}>Round</div>
                    <div className={styles.value}>{capitalize(round)}</div>
                </div>
                <div className={styles.metaItem}>
                    <div className={styles.label}>Players</div>
                    <div className={styles.value}>
                        {playerCount}/{maxPlayers}
                    </div>
                </div>
            </div>
            <button className={styles.leaveButton} disabled={leaveDisabled} onClick={onLeave}>
                Leave Table
            </button>
        </div>
    );
};

export default TableHeader;
```

- [ ] **Step 2: Create `TableHeader.module.css`**

```css
.header {
    display: flex;
    align-items: center;
    padding: 12px 18px;
    border-bottom: 1px solid var(--border);
    gap: 20px;
    background: var(--bg-app);
}

.club {
    font-family: "Barlow Condensed", system-ui, sans-serif;
    font-size: 18px;
    font-weight: 600;
}

.meta {
    display: flex;
    gap: 18px;
}

.metaItem .label {
    font-size: 9.5px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--text-muted);
}

.metaItem .value {
    font-family: "Barlow Condensed", system-ui, sans-serif;
    font-size: 14px;
    font-weight: 600;
}

.leaveButton {
    margin-left: auto;
    font-family: "Barlow Condensed", system-ui, sans-serif;
    font-size: 12px;
    font-weight: 600;
    background: transparent;
    border: 1px solid var(--border-strong);
    color: var(--text);
    padding: 5px 12px;
    cursor: pointer;
}

.leaveButton:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
```

- [ ] **Step 3: Create `TableSidebar.tsx`**

```tsx
import React from "react";
import type { LegalActionDTO } from "@block52/poker-vm-sdk";
import styles from "./TableSidebar.module.css";

export interface TableSidebarProps {
    legalActions: LegalActionDTO[];
    isPlayerTurn: boolean;
}

export const TableSidebar: React.FC<TableSidebarProps> = ({ legalActions, isPlayerTurn }) => {
    return (
        <div className={styles.sidebar}>
            <div className={styles.panel}>
                <h4 className={styles.heading}>Legal actions</h4>
                {isPlayerTurn && legalActions.length > 0 ? (
                    legalActions.map(action => (
                        <div key={action.action} className={styles.row}>
                            <span className={styles.rowKey}>{action.action}</span>
                            <span>
                                {action.min && action.max && action.min !== action.max ? `${action.min} – ${action.max}` : (action.min ?? "available")}
                            </span>
                        </div>
                    ))
                ) : (
                    <div className={styles.row}>
                        <span className={styles.rowKey}>Not your turn</span>
                    </div>
                )}
            </div>
            <div className={styles.panel}>
                <h4 className={styles.heading}>Hand history</h4>
                <div className={styles.row}>
                    <span className={styles.rowKey}>No hands played yet this session</span>
                </div>
            </div>
        </div>
    );
};

export default TableSidebar;
```

- [ ] **Step 4: Create `TableSidebar.module.css`**

```css
.sidebar {
    width: 220px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 22px 22px 22px 0;
    border-left: 1px solid var(--border);
    margin-left: -1px;
}

.panel {
    background: var(--bg-card);
    border: 1px solid var(--border);
    padding: 14px;
}

.heading {
    font-family: "Barlow Condensed", system-ui, sans-serif;
    font-size: 13px;
    font-weight: 600;
    margin: 0 0 10px;
}

.row {
    display: flex;
    justify-content: space-between;
    font-size: 11.5px;
    padding: 5px 0;
    border-bottom: 1px solid var(--border);
}

.row:last-child {
    border-bottom: none;
}

.rowKey {
    color: var(--text-muted);
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as after Task 5.

Run: `npx eslint --ext .ts,.tsx src` (scoped)
Expected: same baseline.

Run: `npx vitest run`
Expected: all tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/table/TableHeader.tsx src/components/table/TableHeader.module.css src/components/table/TableSidebar.tsx src/components/table/TableSidebar.module.css
git commit -m "feat: add TableHeader and TableSidebar components"
```

---

### Task 7: `PlayerActionButtons` component

**Files:**
- Create: `src/components/table/PlayerActionButtons.tsx`
- Create: `src/components/table/PlayerActionButtons.module.css`

**Interfaces:**
- Consumes: nothing from earlier tasks in this plan (a presentational action bar — the actual hook-calling logic stays in `Table.tsx`, per the Global Constraint that `Table.tsx`'s existing hook wiring must be preserved; this component receives pre-bound callbacks as props).
- Produces: `PlayerActionButtonsProps` and the `PlayerActionButtons` component — consumed by Task 9 (`Table.tsx`).

This is a **presentational** component — it does not call any action hook itself. `Table.tsx` keeps its existing `runAction`/hook-calling logic exactly as-is (per the Global Constraints) and passes bound callbacks down.

- [ ] **Step 1: Create `PlayerActionButtons.tsx`**

```tsx
import React from "react";
import styles from "./PlayerActionButtons.module.css";

export interface PlayerActionButtonsProps {
    isSubmitting: boolean;
    betAmount: string;
    onBetAmountChange: (value: string) => void;
    callAmount: string;
    onCallAmountChange: (value: string) => void;
    raiseAmount: string;
    onRaiseAmountChange: (value: string) => void;
    onBet: () => void;
    onCall: () => void;
    onRaise: () => void;
    onCheck: () => void;
    onFold: () => void;
    onMuck: () => void;
    onShow: () => void;
    onSitIn: () => void;
    onSitInAndWait: () => void;
    onSitOut: () => void;
    autoStatusNote: string;
}

export const PlayerActionButtons: React.FC<PlayerActionButtonsProps> = ({
    isSubmitting,
    betAmount,
    onBetAmountChange,
    callAmount,
    onCallAmountChange,
    raiseAmount,
    onRaiseAmountChange,
    onBet,
    onCall,
    onRaise,
    onCheck,
    onFold,
    onMuck,
    onShow,
    onSitIn,
    onSitInAndWait,
    onSitOut,
    autoStatusNote,
}) => {
    return (
        <div className={styles.bar}>
            <input
                className={styles.input}
                placeholder="Bet"
                value={betAmount}
                onChange={e => onBetAmountChange(e.target.value)}
            />
            <button className={styles.btn} disabled={isSubmitting} onClick={onBet}>
                Bet
            </button>
            <input
                className={styles.input}
                placeholder="Call"
                value={callAmount}
                onChange={e => onCallAmountChange(e.target.value)}
            />
            <button className={styles.btn} disabled={isSubmitting} onClick={onCall}>
                Call
            </button>
            <input
                className={styles.input}
                placeholder="Raise"
                value={raiseAmount}
                onChange={e => onRaiseAmountChange(e.target.value)}
            />
            <button className={styles.btn} disabled={isSubmitting} onClick={onRaise}>
                Raise
            </button>
            <button className={styles.btn} disabled={isSubmitting} onClick={onCheck}>
                Check
            </button>
            <button className={`${styles.btn} ${styles.danger}`} disabled={isSubmitting} onClick={onFold}>
                Fold
            </button>
            <button className={styles.btn} disabled={isSubmitting} onClick={onMuck}>
                Muck
            </button>
            <button className={styles.btn} disabled={isSubmitting} onClick={onShow}>
                Show
            </button>
            <button className={styles.btn} disabled={isSubmitting} onClick={onSitIn}>
                Sit In
            </button>
            <button className={styles.btn} disabled={isSubmitting} onClick={onSitInAndWait}>
                Sit In And Wait
            </button>
            <button className={styles.btn} disabled={isSubmitting} onClick={onSitOut}>
                Sit Out
            </button>
            {autoStatusNote && <div className={styles.autoNote}>{autoStatusNote}</div>}
        </div>
    );
};

export default PlayerActionButtons;
```

- [ ] **Step 2: Create `PlayerActionButtons.module.css`**

```css
.bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 22px;
    border-top: 1px solid var(--border);
    background: var(--bg-app);
    flex-wrap: wrap;
}

.input {
    font-family: "Barlow Condensed", system-ui, sans-serif;
    font-size: 14px;
    border: 1px solid var(--border-strong);
    background: var(--bg-card);
    color: var(--text);
    padding: 7px 10px;
    width: 90px;
}

.btn {
    font-family: "Barlow Condensed", system-ui, sans-serif;
    font-size: 13px;
    font-weight: 600;
    padding: 9px 14px;
    border: 1px solid var(--border-strong);
    background: transparent;
    color: var(--text);
    cursor: pointer;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.danger {
    border-color: var(--danger);
    color: var(--danger);
}

.autoNote {
    margin-left: auto;
    font-family: Barlow, system-ui, sans-serif;
    font-size: 10.5px;
    color: var(--text-muted);
    font-style: italic;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as after Task 6.

Run: `npx eslint --ext .ts,.tsx src` (scoped)
Expected: same baseline.

Run: `npx vitest run`
Expected: all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/table/PlayerActionButtons.tsx src/components/table/PlayerActionButtons.module.css
git commit -m "feat: add PlayerActionButtons component"
```

---

### Task 8: `NoWalletOverlay` + `TableErrorPage` components

**Files:**
- Create: `src/components/table/NoWalletOverlay.tsx`
- Create: `src/components/table/NoWalletOverlay.module.css`
- Create: `src/components/table/TableErrorPage.tsx`
- Create: `src/components/table/TableErrorPage.module.css`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `NoWalletOverlayProps`/`NoWalletOverlay`, `TableErrorPageProps`/`TableErrorPage` — both consumed by Task 9 (`Table.tsx`).

Per the spec: `NoWalletOverlay` **overlays** a dimmed table (the table stays visible underneath); `TableErrorPage` **replaces** the table area entirely (there's no game state to show underneath a failed connection).

- [ ] **Step 1: Create `NoWalletOverlay.tsx`**

```tsx
import React from "react";
import styles from "./NoWalletOverlay.module.css";

export interface NoWalletOverlayProps {
    onConnect: () => void;
}

export const NoWalletOverlay: React.FC<NoWalletOverlayProps> = ({ onConnect }) => {
    return (
        <div className={styles.scrim}>
            <div className={styles.card}>
                <h3 className={styles.title}>Wallet not connected</h3>
                <p className={styles.body}>Create or import a Block52 wallet to join this table and play.</p>
                <button className={styles.button} onClick={onConnect}>
                    Connect Wallet
                </button>
            </div>
        </div>
    );
};

export default NoWalletOverlay;
```

- [ ] **Step 2: Create `NoWalletOverlay.module.css`**

```css
.scrim {
    position: absolute;
    inset: 0;
    z-index: 10;
    background: color-mix(in srgb, var(--bg-app) 78%, transparent);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
}

.card {
    background: var(--bg-card);
    border: 1px solid var(--border-strong);
    padding: 28px 32px;
    text-align: center;
    width: 340px;
}

.title {
    font-family: "Barlow Condensed", system-ui, sans-serif;
    font-size: 19px;
    font-weight: 600;
    margin: 0 0 8px;
}

.body {
    font-family: Barlow, system-ui, sans-serif;
    font-size: 12.5px;
    color: var(--text-muted);
    margin: 0 0 18px;
    line-height: 1.5;
}

.button {
    font-family: "Barlow Condensed", system-ui, sans-serif;
    font-size: 14px;
    font-weight: 600;
    width: 100%;
    background: var(--accent);
    border: 1px solid var(--accent);
    color: var(--accent-text);
    padding: 10px 0;
    cursor: pointer;
}
```

- [ ] **Step 3: Create `TableErrorPage.tsx`**

```tsx
import React from "react";
import styles from "./TableErrorPage.module.css";

export interface TableErrorPageProps {
    message: string;
    onRetry: () => void;
}

export const TableErrorPage: React.FC<TableErrorPageProps> = ({ message, onRetry }) => {
    return (
        <div className={styles.state}>
            <div className={styles.icon}>!</div>
            <h3 className={styles.title}>Couldn't connect to this table</h3>
            <p className={styles.body}>{message}</p>
            <button className={styles.button} onClick={onRetry}>
                Retry
            </button>
        </div>
    );
};

export default TableErrorPage;
```

- [ ] **Step 4: Create `TableErrorPage.module.css`**

```css
.state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px 24px;
    text-align: center;
}

.icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid var(--danger);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "Barlow Condensed", system-ui, sans-serif;
    font-size: 24px;
    font-weight: 700;
    color: var(--danger);
}

.title {
    font-family: "Barlow Condensed", system-ui, sans-serif;
    font-size: 19px;
    font-weight: 600;
    margin: 0;
}

.body {
    font-family: Barlow, system-ui, sans-serif;
    font-size: 12.5px;
    color: var(--text-muted);
    max-width: 380px;
    line-height: 1.5;
    margin: 0;
}

.button {
    font-family: "Barlow Condensed", system-ui, sans-serif;
    font-size: 14px;
    font-weight: 600;
    background: var(--accent);
    border: 1px solid var(--accent);
    color: var(--accent-text);
    padding: 10px 24px;
    cursor: pointer;
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as after Task 7.

Run: `npx eslint --ext .ts,.tsx src` (scoped)
Expected: same baseline.

Run: `npx vitest run`
Expected: all tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/table/NoWalletOverlay.tsx src/components/table/NoWalletOverlay.module.css src/components/table/TableErrorPage.tsx src/components/table/TableErrorPage.module.css
git commit -m "feat: add NoWalletOverlay and TableErrorPage components"
```

---

### Task 9: Wire everything into `Table.tsx`

**Files:**
- Modify: `src/pages/table/Table.tsx`
- Create: `src/pages/table/Table.module.css`

**Interfaces:**
- Consumes: every component from Tasks 3-8; `resolveTableSize` from Task 2 (for the player-count display, not re-deriving seat math here — `PlayerSeating` owns that internally); `getCosmosAddress` from `../../utils/cosmos/storage` (existing); `isSitAndGoFormat`, `GameFormat` from `@block52/poker-vm-sdk`.
- Produces: nothing — this is the final integration task.

**This task preserves `Table.tsx`'s existing hook-calling logic verbatim** — every `useAutoPostBlinds`/`useAutoDeal`/`useAutoNewHand` call, the `runAction` helper, the `isSubmitting` state, the amount-input state variables, and every manual-hook call (`betHand`, `callHand`, etc.) stay exactly as they are in the current file. Only the JSX returned by the component changes, plus the new state-branching logic described below.

**Ruling on the "waiting for players" condition:** there is no explicit "hand not started" boolean anywhere in `gameState`. The correct, precise condition is `gameState.players.length < gameState.gameOptions.minPlayers` — this directly reflects the real constraint (a hand cannot start below `minPlayers`), rather than an indirect signal like "pot is zero" (which can also be legitimately true for a brief moment between hands).

This task is responsible for not regressing the **horizontal-bleed bug** at the page level too: the outermost page container gets `overflow: hidden` as a hard backstop, per the spec.

- [ ] **Step 1: Create `Table.module.css`**

```css
.page {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--bg-app);
    color: var(--text);
    font-family: Barlow, system-ui, sans-serif;
    /* Hard backstop for the horizontal-bleed bug: nothing inside this page
       (seats positioned at the literal 0%/100% x-coordinate of their
       container, extending half their own width past it) can ever spill
       past the page's own edge, regardless of any padding miscalculation
       in a component nested inside. */
    overflow: hidden;
}

.boardRow {
    display: flex;
    flex: 1;
    min-height: 0;
}

.joinRow {
    display: flex;
    gap: 8px;
    padding: 8px 22px;
}

.connecting {
    padding: 24px;
    font-size: 13px;
    color: var(--text-muted);
}

.validationError {
    padding: 8px 18px;
    font-size: 12px;
    color: var(--danger);
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);
}

.autoIndicator {
    padding: 8px 18px;
    font-size: 12px;
    color: var(--accent);
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);
}
```

- [ ] **Step 2: Replace `Table.tsx`**

Replace the full contents of `src/pages/table/Table.tsx` with:

```tsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PlayerActionType, NonPlayerActionType, hasAction, isSitAndGoFormat } from "@block52/poker-vm-sdk";
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
import { getCosmosAddress } from "../../utils/cosmos/storage";
import type { PlayerActionResult, JoinTableResult, LeaveTableResult } from "../../types";
import { TableHeader } from "../../components/table/TableHeader";
import { TableBoard } from "../../components/table/TableBoard";
import { TableSidebar } from "../../components/table/TableSidebar";
import { PlayerActionButtons } from "../../components/table/PlayerActionButtons";
import { NoWalletOverlay } from "../../components/table/NoWalletOverlay";
import { TableErrorPage } from "../../components/table/TableErrorPage";
import styles from "./Table.module.css";

function formatMicro(value: string): string {
    return (Number(value) / 1_000_000).toFixed(3);
}

const Table: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const tableId = id ?? "";
    const { currentNetwork } = useNetwork();
    const { gameState, gameFormat, isLoading, error, validationError, subscribeToTable, unsubscribeFromTable, getLatestSnapshot } =
        useGameState();
    const legalActions = usePlayerLegalActions();

    const [betAmount, setBetAmount] = useState<string>("");
    const [callAmount, setCallAmount] = useState<string>("");
    const [raiseAmount, setRaiseAmount] = useState<string>("");
    const [buyInAmount, setBuyInAmount] = useState<string>("");
    const [seatNumber, setSeatNumber] = useState<string>("");
    const [actionStatus, setActionStatus] = useState<string>("");
    const [actionError, setActionError] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
        setIsSubmitting(true);
        setActionStatus(`${label}…`);
        setActionError("");
        try {
            const result = await action();
            setActionStatus(`${label} ok: ${result.hash}`);
        } catch (err) {
            setActionError(err instanceof Error ? err.message : String(err));
            setActionStatus("");
        } finally {
            setIsSubmitting(false);
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

    const hasWallet = !!getCosmosAddress();
    const localAddress = getCosmosAddress()?.toLowerCase() ?? null;

    if (error) {
        return (
            <div className={styles.page}>
                <TableErrorPage message={error.message} onRetry={() => id && subscribeToTable(id)} />
            </div>
        );
    }

    if (isLoading || !gameState) {
        return (
            <div className={styles.page}>
                <div className={styles.connecting}>Connecting…</div>
            </div>
        );
    }

    const isUserSeated = gameState.players.some(p => p.address.toLowerCase() === localAddress);
    const hasEmptySeats = gameState.players.length < gameState.gameOptions.maxPlayers;
    const sitAndGoWaiting =
        isSitAndGoFormat(gameFormat) && isUserSeated && hasEmptySeats
            ? {
                  prizePool: formatMicro(gameState.totalPot),
                  seated: gameState.players.length,
                  maxPlayers: gameState.gameOptions.maxPlayers,
              }
            : undefined;

    const content = (
        <>
            <TableHeader
                tableLabel={`Table ${tableId}`}
                smallBlind={formatMicro(gameState.gameOptions.smallBlind)}
                bigBlind={formatMicro(gameState.gameOptions.bigBlind)}
                handNumber={gameState.handNumber}
                round={gameState.round}
                playerCount={gameState.players.length}
                maxPlayers={gameState.gameOptions.maxPlayers}
                onLeave={() => runAction("Leave", () => leaveTable(tableId, currentNetwork))}
                leaveDisabled={isSubmitting}
            />
            {validationError && <div className={styles.validationError}>Validation: {validationError.message}</div>}
            {isDealingNewHand && <div className={styles.autoIndicator}>Dealing next hand…</div>}
            {actionStatus && <div className={styles.autoIndicator}>{actionStatus}</div>}
            {actionError && <div className={styles.validationError}>{actionError}</div>}
            <div className={styles.boardRow}>
                <TableBoard
                    players={gameState.players}
                    maxPlayers={gameState.gameOptions.maxPlayers}
                    localAddress={localAddress}
                    nextToAct={gameState.nextToAct}
                    smallBlindPosition={gameState.smallBlindPosition}
                    bigBlindPosition={gameState.bigBlindPosition}
                    dealer={gameState.dealer}
                    formatStack={formatMicro}
                    communityCards={gameState.communityCards}
                    pot={formatMicro(gameState.totalPot)}
                    round={gameState.round}
                    waitingForPlayers={
                        hasEmptySeats && gameState.players.length < gameState.gameOptions.minPlayers
                            ? {
                                  seated: gameState.players.length,
                                  minPlayers: gameState.gameOptions.minPlayers,
                                  maxPlayers: gameState.gameOptions.maxPlayers,
                              }
                            : undefined
                    }
                />
                <TableSidebar legalActions={legalActions.legalActions} isPlayerTurn={legalActions.isPlayerTurn} />
            </div>
            <PlayerActionButtons
                isSubmitting={isSubmitting}
                betAmount={betAmount}
                onBetAmountChange={setBetAmount}
                callAmount={callAmount}
                onCallAmountChange={setCallAmount}
                raiseAmount={raiseAmount}
                onRaiseAmountChange={setRaiseAmount}
                onBet={() => runAction("Bet", () => betHand(tableId, parseUsdcToMicro(betAmount), currentNetwork))}
                onCall={() => runAction("Call", () => callHand(tableId, parseUsdcToMicro(callAmount), currentNetwork))}
                onRaise={() => runAction("Raise", () => raiseHand(tableId, parseUsdcToMicro(raiseAmount), currentNetwork))}
                onCheck={() => runAction("Check", () => checkHand(tableId, currentNetwork))}
                onFold={() => runAction("Fold", () => foldHand(tableId, currentNetwork))}
                onMuck={() => runAction("Muck", () => muckCards(tableId, currentNetwork))}
                onShow={() => runAction("Show", () => showCards(tableId, currentNetwork))}
                onSitIn={() => runAction("Sit in", () => sitIn(tableId, currentNetwork))}
                onSitInAndWait={() => runAction("Sit in and wait", () => sitInAndWait(tableId, currentNetwork))}
                onSitOut={() => runAction("Sit out", () => sitOut(tableId, currentNetwork))}
                autoStatusNote="Auto: blinds/deal/new-hand fire automatically"
            />
        </>
    );
    void buyInAmount;
    void seatNumber;
    void getLatestSnapshot;
    void joinTable;

    return (
        <div className={styles.page}>
            {content}
            {!hasWallet && <NoWalletOverlay onConnect={() => window.location.assign("#/wallet")} />}
        </div>
    );
};

export default Table;
```

**This draft has unresolved placeholders the implementer must fix before committing** (the `sitAndGoWaiting`/`isUserSeated`/`buyInAmount`/`seatNumber`/`joinTable` `void`-silenced variables above are NOT the final code — they mark real wiring this step deliberately left incomplete for clarity of the surrounding structure). Finish the implementation as follows:

- [ ] **Step 3: Pass `sitAndGoWaiting` into `TableBoard` and wire the Join UI**

Add `sitAndGoWaiting={sitAndGoWaiting}` to the `<TableBoard ...>` call from Step 2's draft (it takes precedence over `waitingForPlayers` inside `TableBoard`'s own branching, per Task 5 — a Sit & Go table that's seated-but-not-full should show the prize pool, not the generic cash-table waiting message, even though both conditions could technically be true at once; `TableBoard`'s `sitAndGoWaiting` prop check comes first in its own JSX, so passing both is safe and this precedence falls out naturally — no extra logic needed in `Table.tsx` itself beyond computing both values correctly).

Add the Join/Leave row using `buyInAmount`/`seatNumber` (currently unused placeholders) — add this as a new row above `PlayerActionButtons`, matching the current debug page's existing Join UI pattern. Use the `.joinRow` class added to `Table.module.css` in Step 1 (not an inline `style` prop — this codebase's styling convention is CSS Modules only):

```tsx
<div className={styles.joinRow}>
    <input
        placeholder="Buy-in (USDC)"
        value={buyInAmount}
        onChange={e => setBuyInAmount(e.target.value)}
    />
    <input placeholder="Seat (optional)" value={seatNumber} onChange={e => setSeatNumber(e.target.value)} />
    <button
        disabled={isSubmitting}
        onClick={() =>
            runAction("Join", () =>
                joinTable(tableId, { amount: buyInAmount, seatNumber: seatNumber ? Number(seatNumber) : undefined }, currentNetwork, getLatestSnapshot)
            )
        }
    >
        Join
    </button>
</div>
```

Remove the `void joinTable; void getLatestSnapshot; void buyInAmount; void seatNumber;` scaffolding lines once this is wired in. `latestEvents` is deliberately left out of the `useGameState()` destructure entirely (Step 2) rather than pulled in and silenced — this design's sidebar hand-history panel is a static placeholder per this task's ruling, not wired to `latestEvents`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as after Task 8 (62 lines) — this step is the most likely to introduce a real type error given its size; investigate and fix any new one rather than suppressing it.

Run: `npx eslint --ext .ts,.tsx src` (scoped to `src`, from this worktree root)
Expected: same baseline warning count as after Task 8 — fix any new warning this step introduces (in particular, double-check no `void`-silenced variable scaffolding was left behind after Step 3's cleanup, since an actually-unused variable should be removed, not `void`-silenced, once its real wiring is in place).

Run: `npx vitest run`
Expected: all tests pass (unchanged from Task 8 — this task adds no new tests).

Run: `yarn start`, navigate to a table (requires a live backend/wallet to fully exercise — if unavailable in this environment, confirm at minimum that the app boots with no console errors traceable to this change, and that the no-wallet overlay renders correctly with no wallet configured, which doesn't require a live table connection). If a live table is reachable: confirm the header/sidebar/felt/seats/action-bar all render without the 4 documented layout bugs (specifically: check a hand where only some players have a current bet showing, to confirm the avatar-alignment fix from Task 3 holds under real, mixed data — not just the hand-built fixtures used during this session's visual design).

- [ ] **Step 5: Commit**

```bash
git add src/pages/table/Table.tsx src/pages/table/Table.module.css
git commit -m "feat: wire the real table UI into Table.tsx"
```

---

## Self-Review Notes

- **Spec coverage:** every component named in the spec's "Component breakdown" section has a task (Tasks 3-8 for the 7 sub-components, Task 9 for `Table.tsx` itself as the root). The theme tokens (Task 1) and seat geometry (Task 2) sections of the spec are covered. All 5 states (active hand, waiting-for-players, Sit & Go waiting, no-wallet, error) are wired in Task 9. All 4 documented layout bugs have an explicit owning task and a "must not regress" note in that task's description. The "no fabricated hand history" ruling from the spec's data-flow section is stated explicitly in Task 6.
- **Type consistency:** `PlayerSeatingProps` (Task 4) is extended (via `Omit<PlayerSeatingProps, "players">`) by `TableBoardProps` (Task 5) rather than redefining an overlapping prop list — verified the field names match exactly between the two. `getSeatPercent`/`resolveTableSize`/`seatToUiPosition`'s signatures (Task 2) are used identically in `PlayerSeating.tsx` (Task 4) — same parameter order, same types. `SeatProps` (Task 3) fields (`left`/`top`/`occupied`/`isActive`/etc.) match exactly how `PlayerSeating.tsx` constructs each `<Seat>` call.
- **No regression:** no task modifies `GameStateContext.tsx`, `GameMessageBus.ts`, `client.ts`, `transportAction.ts`, `usePlayerLegalActions.ts`, or any existing action-hook file — confirmed by re-reading every task's "Files" section. Task 9's `Table.tsx` rewrite preserves every existing hook call's exact signature and the `runAction`/`isSubmitting` pattern from the current merged file.
