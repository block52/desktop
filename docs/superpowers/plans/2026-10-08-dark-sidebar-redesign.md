# Dark Sidebar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's light/dark blue-gray/sharp-corner theme with a single dark/purple/12px-radius theme, replace the top `Navbar` with a persistent left `Sidebar` (wrapping every route, including the Table page), and re-skin Dashboard/GameWallet/TableList/Table/modals to the new tokens.

**Architecture:** One new global token set in `src/index.css` (dark-only, no more `prefers-color-scheme`) drives nearly every visual change automatically via the existing `var(--token)` CSS Modules convention already in place from an earlier pass this session. On top of that: one new component (`Sidebar`), one router restructure (flex layout: sidebar + content), one small Dashboard header addition, and a mechanical sweep adding `border-radius: var(--radius)` to "chrome" selectors across already-token-driven `.module.css` files (pills/circles/mini-card exceptions untouched).

**Tech Stack:** React + TypeScript, CSS Modules, react-router-dom (`MemoryRouter`), Vite/Electron Forge.

**Spec:** `docs/superpowers/specs/2026-10-08-dark-sidebar-redesign-design.md`

## Global Constraints

- New theme tokens (exact values, dark-only, replace the existing light/dark pair in `src/index.css`):
  ```css
  --bg-app: hsl(240 33% 8%);
  --bg-card: hsl(240 26% 11%);
  --border: hsl(240 24% 15%);
  --border-strong: hsl(240 24% 22%);
  --text: hsl(210 40% 98%);
  --text-muted: hsl(215 20% 65%);
  --accent: hsl(263 83% 58%);
  --accent-text: hsl(0 0% 100%);
  --danger: hsl(0 62.8% 30.6%);
  --radius: 12px;
  ```
- Radius exceptions are unchanged and must NOT be touched: `999px` (pill buttons/badges), `50%` (circular avatars), `2px`/`4px` (mini playing-card shapes). Only add `border-radius: var(--radius);` to plain "chrome" selectors (cards, panels, buttons, inputs) that currently have no radius or the old sharp-corner `0`/no declaration.
- Sidebar's own nav-item active/hover radius is `10px` (measured from the mockup) — a distinct, smaller one-off value, not `var(--radius)`.
- Font: swap `Barlow`/`"Barlow Condensed"` → `Inter` in font-family declarations touched by this plan. Confirmed via `index.html`/`index.css`: no `@font-face`, no `<link>` font loading, no bundled `.woff`/`.ttf` files anywhere in the repo — `Barlow` has always silently fallen back to `system-ui`. Swapping the family name costs nothing and adds no new dependency (it'll fall back to `system-ui` identically on machines without `Inter` installed). Leave the `system-ui, sans-serif` fallback chain in place. Do not add Google Fonts or any font file — out of scope.
- `tsc --noEmit` must not exceed the established baseline of 62 pre-existing errors (all unrelated to this work — do not investigate them, just confirm the count doesn't increase).
- `yarn lint` must not exceed the established baseline of 27 warnings / 0 errors.
- `yarn vitest run` must stay at 110 passing tests / 9 files — no test files touch any file this plan modifies, so this plan adds no tests; it's a visual/structural pass.
- Quotes: double quotes in all TS/TSX per CLAUDE.md.
- Electron window is NOT frameless (`src/main.ts:13-20`, default `BrowserWindow`, no `frame: false`) — the old Navbar's `-webkit-app-region: drag`/`no-drag` declarations are inert/unused today and must NOT be ported to Sidebar.
- `AppBackground` (`src/components/background/AppBackground.tsx` + `.module.css`) needs NO changes — confirmed its root and every child layer use `position: fixed; inset: 0;`, fully independent of document flow/DOM position, so the router's new flex wrapper doesn't affect it.

---

### Task 1: Rewrite global theme tokens

**Files:**
- Modify: `src/index.css` (full file, 38 lines)

**Interfaces:**
- Produces: the 10 CSS custom properties (`--bg-app`, `--bg-card`, `--border`, `--border-strong`, `--text`, `--text-muted`, `--accent`, `--accent-text`, `--danger`, `--radius`) every later task's `.module.css` edits reference via `var(...)`.

- [ ] **Step 1: Replace the file contents**

Replace the entire current contents of `src/index.css`:

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

with:

```css
:root {
  --text: hsl(210 40% 98%);
  --text-muted: hsl(215 20% 65%);
  --border: hsl(240 24% 15%);
  --border-strong: hsl(240 24% 22%);
  --accent: hsl(263 83% 58%);
  --accent-text: hsl(0 0% 100%);
  --danger: hsl(0 62.8% 30.6%);
  --bg-app: hsl(240 33% 8%);
  --bg-card: hsl(240 26% 11%);
  --radius: 12px;
}

*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family: Inter, system-ui, sans-serif;
  background: var(--bg-app);
  color: var(--text);
}
```

- [ ] **Step 2: Verify the app still boots with no new console errors**

Run: `pkill -f "Application Support/desktop" 2>/dev/null; pkill -f "block52/desktop/node_modules/electron" 2>/dev/null; pkill -f "electron-forge" 2>/dev/null; sleep 3; yarn start`

Expected: app boots (now visually broken/inconsistent in places until later tasks land — that's expected, this task only changes token *values*, later tasks add the `--radius` usages and the Sidebar). No new errors in the terminal output beyond the pre-existing benign Vite/WalletConnect warnings already known from earlier this session.

- [ ] **Step 3: Run baseline checks**

Run: `yarn tsc --noEmit 2>&1 | tail -5` — expect error count unchanged (still at baseline, this task touches no `.ts`/`.tsx`).
Run: `yarn lint 2>&1 | tail -5` — expect warning count unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat: replace light/dark theme tokens with dark-only purple palette"
```

---

### Task 2: Build the Sidebar component

**Files:**
- Create: `src/components/sidebar/Sidebar.tsx`
- Create: `src/components/sidebar/Sidebar.module.css`

**Interfaces:**
- Consumes: `useNetwork()` from `../../context/NetworkContext` (existing, `{ currentNetwork }`), `getCosmosClient` from `../../utils/cosmos/client` (existing), `NetworkSelector` default... actually named export `{ NetworkSelector }` from `../navbar/NetworkSelector` (existing, unmodified).
- Produces: `Sidebar` default export, a `React.FC` with no props, rendering a `<nav>`-like persistent column. Later tasks (Task 3) mount it at `<Sidebar />` in `src/router.tsx`.

- [ ] **Step 1: Create `src/components/sidebar/Sidebar.tsx`**

```tsx
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { useNetwork } from "../../context/NetworkContext";
import { getCosmosClient } from "../../utils/cosmos/client";
import { NetworkSelector } from "../navbar/NetworkSelector";

const Logo: React.FC = () => {
    const [imgError, setImgError] = useState(false);
    return (
        <Link to="/" className={styles.logo}>
            {!imgError ? (
                <img
                    src="/block52.png"
                    alt="Block52"
                    className={styles.logoImage}
                    onError={() => setImgError(true)}
                />
            ) : (
                <span className={styles.logoText}>
                    block<span className={styles.logoAccent}>52</span>
                    <span className={styles.logoDiamond}>◆</span>
                </span>
            )}
        </Link>
    );
};

interface NavItemProps {
    to?: string;
    active?: boolean;
    children: React.ReactNode;
}

const NavItem: React.FC<NavItemProps> = ({ to, active, children }) => {
    if (to) {
        return (
            <Link to={to} className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}>
                {children}
            </Link>
        );
    }
    return (
        <button type="button" className={styles.navItemDisabled} disabled aria-disabled="true">
            {children}
        </button>
    );
};

const Sidebar: React.FC = () => {
    const location = useLocation();
    const { currentNetwork } = useNetwork();
    const [latestBlockHeight, setLatestBlockHeight] = useState<string | null>(null);

    useEffect(() => {
        const fetchBlockHeight = async () => {
            try {
                const cosmosClient = getCosmosClient({
                    rpc: currentNetwork.rpc,
                    rest: currentNetwork.rest,
                });

                if (!cosmosClient) return;

                const blocks = await cosmosClient.getLatestBlocks(1);
                if (blocks.length > 0) {
                    setLatestBlockHeight(blocks[0].block.header.height);
                }
            } catch {
                setLatestBlockHeight(null);
            }
        };

        fetchBlockHeight();
        const interval = setInterval(fetchBlockHeight, 10000);

        return () => clearInterval(interval);
    }, [currentNetwork]);

    const isLobby = location.pathname === "/";
    const isWallet = location.pathname === "/wallet";

    return (
        <aside className={styles.sidebar}>
            <Logo />

            <div className={styles.group}>
                <span className={styles.groupLabel}>Play</span>
                <NavItem to="/" active={isLobby}>Lobby</NavItem>
                <NavItem to="/wallet" active={isWallet}>Wallet</NavItem>
                <NavItem>Hand history</NavItem>
                <NavItem>Players</NavItem>
            </div>

            <div className={styles.group}>
                <span className={styles.groupLabel}>Network</span>
                <div className={styles.networkSelectorWrap}>
                    <NetworkSelector />
                </div>
                <NavItem>Block explorer</NavItem>
                <NavItem>Hand distribution</NavItem>
                <NavItem>Tech notes</NavItem>
            </div>

            <div className={styles.footer}>
                <NavItem>Admin</NavItem>
                <div className={styles.statusChip}>
                    <span className={styles.statusDot} />
                    <span className={styles.statusText}>
                        {currentNetwork.name}
                        {latestBlockHeight !== null && (
                            <> · Block #{Number(latestBlockHeight).toLocaleString()}</>
                        )}
                    </span>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
```

- [ ] **Step 2: Create `src/components/sidebar/Sidebar.module.css`**

```css
.sidebar {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 20px 14px;
    background-color: var(--bg-app);
    border-right: 1px solid var(--border);
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    font-family: Inter, system-ui, sans-serif;
}

/* ── Logo ── */
.logo {
    display: flex;
    align-items: center;
    text-decoration: none;
    padding: 0 6px;
}

.logoImage {
    height: 26px;
    width: auto;
    object-fit: contain;
}

/* Brand mark colors are fixed — the logo keeps its own identity colors
   rather than following the generic UI accent. */
.logoText {
    font-size: 18px;
    font-weight: 800;
    color: #c084fc;
    letter-spacing: -0.03em;
}

.logoAccent {
    color: #818cf8;
}

.logoDiamond {
    color: var(--text);
    font-size: 10px;
    margin-left: 2px;
    vertical-align: super;
}

/* ── Groups ── */
.group {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.groupLabel {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
    padding: 0 10px 6px;
}

.navItem {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    text-decoration: none;
    border: 1px solid transparent;
    border-radius: 10px;
    cursor: pointer;
    transition: color 0.15s, background-color 0.15s, border-color 0.15s;
    background: transparent;
    text-align: left;
    width: 100%;
}

.navItem:hover {
    color: var(--text);
    background-color: var(--border);
}

.navItemActive {
    color: var(--text);
    background-color: color-mix(in srgb, var(--accent) 14%, transparent);
    border-color: color-mix(in srgb, var(--accent) 38%, transparent);
}

.navItemDisabled {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    opacity: 0.4;
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    cursor: not-allowed;
    text-align: left;
    width: 100%;
}

/* ── Network selector (ported, widened to fill the sidebar row) ── */
.networkSelectorWrap {
    padding: 0 10px;
}

.networkSelectorWrap :global(.container) {
    width: 100%;
}

.networkSelectorWrap :global(.trigger) {
    width: 100%;
    justify-content: space-between;
}

/* ── Footer ── */
.footer {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-top: 1px solid var(--border);
    padding-top: 14px;
}

.statusChip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}

.statusText {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.statusDot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background-color: #4ade80;
    flex-shrink: 0;
    animation: pulse 2.5s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.35; }
}
```

Note on `:global(.container)`/`:global(.trigger)`: `NetworkSelector.module.css` defines `.container`/`.trigger` as CSS-Modules-scoped classnames (compiled to hashed names at build time), so a plain `.networkSelectorWrap .container` selector in `Sidebar.module.css` would never match the hashed classnames actually applied in the DOM. `:global(...)` is required here specifically because `Sidebar.module.css` needs to reach into a *different* CSS Module's output — this is an exception, not a pattern to reuse elsewhere in this plan.

- [ ] **Step 3: Verify compiles with no new TypeScript/lint errors**

Run: `yarn tsc --noEmit 2>&1 | tail -5` — expect unchanged baseline (this file isn't imported anywhere yet, so it's checked but not yet exercised at runtime).
Run: `yarn lint 2>&1 | tail -5` — expect unchanged baseline.

- [ ] **Step 4: Commit**

```bash
git add src/components/sidebar/Sidebar.tsx src/components/sidebar/Sidebar.module.css
git commit -m "feat: add Sidebar component"
```

---

### Task 3: Wire Sidebar into the router, replacing Navbar

**Files:**
- Modify: `src/router.tsx` (full file, 24 lines)

**Interfaces:**
- Consumes: `Sidebar` default export from Task 2 (`../components/sidebar/Sidebar` relative to `src/router.tsx`, i.e. `./components/sidebar/Sidebar`).

- [ ] **Step 1: Replace the file contents**

Replace the entire current contents of `src/router.tsx`:

```tsx
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AppBackground from "./components/background/AppBackground";
import Navbar from "./components/navbar/Navbar";
import Dashboard from "./pages/dashboard/Dashboard";
import Table from "./pages/table/Table";
import Wallet from "./pages/Wallet";

const Router: React.FC = () => {
    return (
        <MemoryRouter initialEntries={["/"]}>
            <AppBackground />
            <Navbar />
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/table/:id" element={<Table />} />
                <Route path="/wallet" element={<Wallet />} />
            </Routes>
        </MemoryRouter>
    );
};

export default Router;
```

with:

```tsx
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AppBackground from "./components/background/AppBackground";
import Sidebar from "./components/sidebar/Sidebar";
import Dashboard from "./pages/dashboard/Dashboard";
import Table from "./pages/table/Table";
import Wallet from "./pages/Wallet";

const Router: React.FC = () => {
    return (
        <MemoryRouter initialEntries={["/"]}>
            <AppBackground />
            <div style={{ position: "relative", display: "flex", minHeight: "100vh" }}>
                <Sidebar />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/table/:id" element={<Table />} />
                        <Route path="/wallet" element={<Wallet />} />
                    </Routes>
                </div>
            </div>
        </MemoryRouter>
    );
};

export default Router;
```

(The inline `style` here is the one accepted exception to the CSS Modules convention established earlier this session — it's a one-off structural layout wrapper with no reusable class identity, not a component with its own `.module.css`. If a reviewer prefers a dedicated `Router.module.css`, that's an acceptable alternative; either is fine.)

- [ ] **Step 2: Verify the app boots and the sidebar renders on every route**

Run the restart sequence from Task 1 Step 2, then manually navigate (via the running app) to `/` (Dashboard), click into a table (`/table/:id`), and to `/wallet` — confirm the Sidebar renders in all three (it no longer hides itself on `/table/` routes, unlike the old `Navbar`), and that `Lobby` shows active state on `/` and `Wallet` shows active state on `/wallet`.

- [ ] **Step 3: Run baseline checks**

Run: `yarn tsc --noEmit 2>&1 | tail -5` — expect unchanged baseline.
Run: `yarn lint 2>&1 | tail -5` — expect unchanged baseline.
Run: `yarn vitest run 2>&1 | tail -15` — expect 110 passed / 9 files, unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/router.tsx
git commit -m "feat: replace Navbar with Sidebar in router, wrap every route"
```

---

### Task 4: Fix Table page layout for the sidebar, apply radius tokens to Table/game-UI chrome

**Files:**
- Modify: `src/pages/table/Table.module.css`
- Modify: `src/components/table/TableHeader.module.css`
- Modify: `src/components/table/TableSidebar.module.css`
- Modify: `src/components/table/PlayerActionButtons.module.css`
- Modify: `src/components/table/NoWalletOverlay.module.css`
- Modify: `src/components/table/TableErrorPage.module.css`

**Interfaces:**
- Consumes: `--radius` token from Task 1.

Note: `src/components/table/TableBoard.module.css` and `src/components/table/Seat.module.css` were checked and need NO changes — see Step 2.

- [ ] **Step 1: Fix the stale vertical-space calculation in `Table.module.css`**

The old top `Navbar` was `position: sticky` and 48px tall, so `Table.module.css`'s `.page` subtracted that height from the viewport (`min-height: calc(100vh - 48px)`). The new `Sidebar` takes horizontal space instead (handled by the router's flex wrapper from Task 3), not vertical — so this subtraction is now wrong and must be removed.

In `src/pages/table/Table.module.css`, change:
```css
.page {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: calc(100vh - 48px);
    background: var(--bg-app);
    color: var(--text);
    font-family: Barlow, system-ui, sans-serif;
```
to:
```css
.page {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--bg-app);
    color: var(--text);
    font-family: Inter, system-ui, sans-serif;
```

(Leave the `overflow: hidden` and its explanatory comment immediately below untouched — that's the unrelated horizontal-bleed backstop from earlier this session.)

- [ ] **Step 2: Add `border-radius: var(--radius)` to chrome selectors**

Exact selectors confirmed by reading each file directly (everything else in these files is already a correct pill/circle/mini-card/stadium exception and must NOT be touched):

- `src/components/table/TableHeader.module.css`: `.leaveButton`
- `src/components/table/TableSidebar.module.css`: `.panel`
- `src/components/table/PlayerActionButtons.module.css`: `.input`, `.btn`
- `src/components/table/NoWalletOverlay.module.css`: `.card`, `.button`, `.backButton`
- `src/components/table/TableErrorPage.module.css`: `.button`, `.backButton` (NOT `.icon` — that's a 50% circle, correctly unchanged)
- `src/components/table/TableBoard.module.css`: **no changes** — every surface (`.rail`/`.felt` at `9999px` stadium shape, `.card` at `4px` mini-card) is already a correct, documented exception.
- `src/components/table/Seat.module.css`: **no changes** — every surface (`.avatar` at `50%`, `.badge`/`.nameplate`/`.bet` at `999px`, `.miniCard` at `2px`) is already a correct, documented exception.

- [ ] **Step 3: Visual verification**

Restart the app (Task 1 Step 2's command) and navigate to a table page. Confirm: cards/panels/buttons in the table header, sidebar, and action bar show visibly rounded (12px) corners; the table felt, player avatars, hole-card mini-rectangles, and any pill-shaped badges/nameplates look unchanged (still their pre-existing pill/circle/mini-card radius).

- [ ] **Step 4: Run baseline checks**

Run: `yarn tsc --noEmit 2>&1 | tail -5` — unchanged baseline (CSS-only changes plus one CSS-only Table.module.css edit; no `.tsx` touched).
Run: `yarn lint 2>&1 | tail -5` — unchanged baseline.
Run: `yarn vitest run 2>&1 | tail -15` — 110 passed / 9 files, unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/pages/table/Table.module.css src/components/table/TableHeader.module.css src/components/table/TableSidebar.module.css src/components/table/PlayerActionButtons.module.css src/components/table/NoWalletOverlay.module.css src/components/table/TableErrorPage.module.css
git commit -m "fix: correct Table page vertical sizing for sidebar layout, apply radius tokens to game UI chrome"
```

---

### Task 5: Dashboard header (title, balance pill, Deposit button, avatar)

**Files:**
- Modify: `src/pages/dashboard/Dashboard.tsx` (full file, 124 lines)
- Modify: `src/pages/dashboard/Dashboard.module.css`

**Interfaces:**
- Consumes: `balance`, `cosmosAddress` from `useCosmosWallet()` (existing, unchanged); `COSMOS_CONSTANTS.TOKEN_DENOM` from `@block52/poker-vm-sdk` (existing, unchanged).
- Produces: a local `usdcBalanceAmount: string` constant, replacing 3 duplicate inline `.find(...)` lookups, reused by the new header AND the existing 3 modal props.

- [ ] **Step 1: Replace `src/pages/dashboard/Dashboard.tsx`**

Replace the entire current contents:

```tsx
import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import GameWallet from "../../components/gameWallet/GameWallet";
import SendModal from "../../components/modal/SendModal";
import WithdrawModal from "../../components/modal/WithdrawModal";
import DepositModal from "../../components/modal/DepositModal";
import { useCosmosWallet } from "../../hooks/useCosmosWallet";
import { useNetwork } from "../../context/NetworkContext";
import TableList from "../../components/tableList/TableList";
import {
  getCosmosMnemonic,
  getCosmosAddress,
} from "../../utils/cosmos/storage";
import {
  createSigningClientFromMnemonic,
  COSMOS_CONSTANTS,
} from "@block52/poker-vm-sdk";
import styles from "./Dashboard.module.css";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { address: cosmosAddress, balance, refreshBalance } = useCosmosWallet();
  const { currentNetwork } = useNetwork();

  const [showSendModal, setShowSendModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  const goToWallet = useCallback(() => navigate("/wallet"), [navigate]);

  const handleSend = useCallback(
    async (recipient: string, amountUsdc: number): Promise<string> => {
      const mnemonic = getCosmosMnemonic();
      const fromAddress = getCosmosAddress();

      if (!mnemonic || !fromAddress) {
        throw new Error(
          "No wallet found. Please create or import a wallet first.",
        );
      }

      const signingClient = await createSigningClientFromMnemonic(
        {
          rpcEndpoint: currentNetwork.rpc,
          restEndpoint: currentNetwork.rest,
          chainId: COSMOS_CONSTANTS.CHAIN_ID,
          prefix: COSMOS_CONSTANTS.ADDRESS_PREFIX,
          denom: COSMOS_CONSTANTS.GAS_DENOM,
          gasPrice: COSMOS_CONSTANTS.DEFAULT_GAS_PRICE,
        },
        mnemonic,
      );

      const amountMicro = BigInt(
        Math.floor(amountUsdc * Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)),
      );
      return signingClient.sendTokens(
        fromAddress,
        recipient,
        amountMicro,
        COSMOS_CONSTANTS.TOKEN_DENOM,
      );
    },
    [currentNetwork],
  );

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <GameWallet
            cosmosAddress={cosmosAddress}
            usdcBalance={
              balance.find((b) => b.denom === COSMOS_CONSTANTS.TOKEN_DENOM)
                ?.amount ?? "0"
            }
            onDeposit={() => setShowDepositModal(true)}
            onWithdraw={() => setShowWithdrawModal(true)}
            onSend={() => setShowSendModal(true)}
            onCreateWallet={goToWallet}
            onImportWallet={goToWallet}
            onRefresh={refreshBalance}
          />
        </aside>
        <main className={styles.main}>
          <TableList />
        </main>
      </div>

      {showSendModal && cosmosAddress && (
        <SendModal
          fromAddress={cosmosAddress}
          usdcBalance={
            balance.find((b) => b.denom === COSMOS_CONSTANTS.TOKEN_DENOM)
              ?.amount ?? "0"
          }
          onSend={handleSend}
          onClose={() => setShowSendModal(false)}
        />
      )}

      {showWithdrawModal && (
        <WithdrawModal
          usdcBalance={
            balance.find((b) => b.denom === COSMOS_CONSTANTS.TOKEN_DENOM)
              ?.amount ?? "0"
          }
          onClose={() => setShowWithdrawModal(false)}
        />
      )}

      {showDepositModal && cosmosAddress && (
        <DepositModal
          cosmosAddress={cosmosAddress}
          onClose={() => setShowDepositModal(false)}
          onDepositConfirmed={refreshBalance}
        />
      )}
    </div>
  );
};

export default Dashboard;
```

with:

```tsx
import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import GameWallet from "../../components/gameWallet/GameWallet";
import SendModal from "../../components/modal/SendModal";
import WithdrawModal from "../../components/modal/WithdrawModal";
import DepositModal from "../../components/modal/DepositModal";
import { useCosmosWallet } from "../../hooks/useCosmosWallet";
import { useNetwork } from "../../context/NetworkContext";
import TableList from "../../components/tableList/TableList";
import {
  getCosmosMnemonic,
  getCosmosAddress,
} from "../../utils/cosmos/storage";
import {
  createSigningClientFromMnemonic,
  COSMOS_CONSTANTS,
} from "@block52/poker-vm-sdk";
import styles from "./Dashboard.module.css";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { address: cosmosAddress, balance, refreshBalance } = useCosmosWallet();
  const { currentNetwork } = useNetwork();

  const [showSendModal, setShowSendModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  const goToWallet = useCallback(() => navigate("/wallet"), [navigate]);

  const usdcBalanceAmount =
    balance.find((b) => b.denom === COSMOS_CONSTANTS.TOKEN_DENOM)?.amount ?? "0";

  const avatarInitials = cosmosAddress
    ? cosmosAddress.slice(2, 4).toUpperCase()
    : null;

  const handleSend = useCallback(
    async (recipient: string, amountUsdc: number): Promise<string> => {
      const mnemonic = getCosmosMnemonic();
      const fromAddress = getCosmosAddress();

      if (!mnemonic || !fromAddress) {
        throw new Error(
          "No wallet found. Please create or import a wallet first.",
        );
      }

      const signingClient = await createSigningClientFromMnemonic(
        {
          rpcEndpoint: currentNetwork.rpc,
          restEndpoint: currentNetwork.rest,
          chainId: COSMOS_CONSTANTS.CHAIN_ID,
          prefix: COSMOS_CONSTANTS.ADDRESS_PREFIX,
          denom: COSMOS_CONSTANTS.GAS_DENOM,
          gasPrice: COSMOS_CONSTANTS.DEFAULT_GAS_PRICE,
        },
        mnemonic,
      );

      const amountMicro = BigInt(
        Math.floor(amountUsdc * Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)),
      );
      return signingClient.sendTokens(
        fromAddress,
        recipient,
        amountMicro,
        COSMOS_CONSTANTS.TOKEN_DENOM,
      );
    },
    [currentNetwork],
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Lobby</h1>
          <p className={styles.subtitle}>Every shuffle verified on-chain. Pick a seat.</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.balancePill}>
            ${(Number(usdcBalanceAmount) / Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)).toFixed(2)}
          </div>
          <button className={styles.depositButton} onClick={() => setShowDepositModal(true)}>
            Deposit
          </button>
          {avatarInitials && <div className={styles.avatar}>{avatarInitials}</div>}
        </div>
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <GameWallet
            cosmosAddress={cosmosAddress}
            usdcBalance={usdcBalanceAmount}
            onDeposit={() => setShowDepositModal(true)}
            onWithdraw={() => setShowWithdrawModal(true)}
            onSend={() => setShowSendModal(true)}
            onCreateWallet={goToWallet}
            onImportWallet={goToWallet}
            onRefresh={refreshBalance}
          />
        </aside>
        <main className={styles.main}>
          <TableList />
        </main>
      </div>

      {showSendModal && cosmosAddress && (
        <SendModal
          fromAddress={cosmosAddress}
          usdcBalance={usdcBalanceAmount}
          onSend={handleSend}
          onClose={() => setShowSendModal(false)}
        />
      )}

      {showWithdrawModal && (
        <WithdrawModal
          usdcBalance={usdcBalanceAmount}
          onClose={() => setShowWithdrawModal(false)}
        />
      )}

      {showDepositModal && cosmosAddress && (
        <DepositModal
          cosmosAddress={cosmosAddress}
          onClose={() => setShowDepositModal(false)}
          onDepositConfirmed={refreshBalance}
        />
      )}
    </div>
  );
};

export default Dashboard;
```

- [ ] **Step 2: Add header styles to `src/pages/dashboard/Dashboard.module.css`**

Read the current file first (it has a `.page`/`.layout`/`.sidebar`/`.main` selector set from this session's earlier token migration). Add these new selectors (exact names referenced above: `.header`, `.title`, `.subtitle`, `.headerActions`, `.balancePill`, `.depositButton`, `.avatar`):

```css
.header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 20px 24px;
    gap: 16px;
}

.title {
    font-family: Inter, system-ui, sans-serif;
    font-size: 24px;
    font-weight: 700;
    color: var(--text);
    margin: 0 0 4px;
}

.subtitle {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
}

.headerActions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
}

.balancePill {
    background-color: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
    font-variant-numeric: tabular-nums;
}

.depositButton {
    background: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 999px;
    color: var(--accent-text);
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    padding: 9px 18px;
    transition: opacity 0.15s;
}

.depositButton:hover {
    opacity: 0.85;
}

.avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background-color: color-mix(in srgb, var(--accent) 25%, transparent);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    flex-shrink: 0;
}
```

If any selector name above already exists in the file from the earlier session (e.g. if `.page` already sets padding that would double up with the new `.header`'s padding), adjust spacing so the header and the existing `.layout` row don't double-pad — this is a visual judgment call to make while looking at the running app, not a fixed rule.

- [ ] **Step 3: Visual verification**

Restart the app (Task 1 Step 2's command), open the Dashboard (`/`). Confirm: "Lobby" title + subtitle render top-left; a balance pill showing the USDC balance, a "Deposit" button (opens the existing Deposit modal — click it to confirm), and (if a wallet exists) a 2-letter avatar render top-right; the existing `GameWallet` sidebar card and `TableList` still render below, unchanged in behavior.

- [ ] **Step 4: Run baseline checks**

Run: `yarn tsc --noEmit 2>&1 | tail -5` — unchanged baseline.
Run: `yarn lint 2>&1 | tail -5` — unchanged baseline.
Run: `yarn vitest run 2>&1 | tail -15` — 110 passed / 9 files, unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/pages/dashboard/Dashboard.tsx src/pages/dashboard/Dashboard.module.css
git commit -m "feat: add Dashboard header with title, balance pill, Deposit button, avatar"
```

---

### Task 6: Apply radius tokens to GameWallet, wallet modals, and TableList

**Files:**
- Modify: `src/components/gameWallet/GameWallet.module.css`
- Modify: `src/components/modal/SendModal.module.css`
- Modify: `src/components/modal/WithdrawModal.module.css`
- Modify: `src/components/modal/DepositModal.module.css`
- Modify: `src/components/tableList/TableList.module.css`

**Interfaces:**
- Consumes: `--radius` token from Task 1.

- [ ] **Step 1: `GameWallet.module.css`**

Add `border-radius: var(--radius);` to: `.container`, `.addressInput`, `.balanceCard`, `.primaryButton`, `.secondaryButton`, `.web3Address`, `.disconnectButton`.
Do NOT touch `.balanceIcon` (keeps its existing `border-radius: 50%`).

- [ ] **Step 2: `SendModal.module.css`**

Add `border-radius: var(--radius);` to: `.modal`, `.input`, `.primaryButton`, `.cancelButton`, `.balanceBox`, `.errorBanner`, `.hashBox`.

- [ ] **Step 3: `WithdrawModal.module.css`**

Add `border-radius: var(--radius);` to: `.modal`, `.balanceCard`, `.infoCard`, `.alertSuccess`, `.alertWarning`, `.errorBanner`, `.addressBox`, `.input`, `.primaryButton`, `.cancelButton`.
Do NOT touch `.stepCircle` or `.spinner` (both correctly keep their existing `border-radius: 50%`).

- [ ] **Step 4: `DepositModal.module.css`**

Add `border-radius: var(--radius);` to: `.modal`, `.tokenButton`, `.tokenButtonSelected`, `.balanceBox`, `.input`, `.addressBox`, `.errorBanner`, `.primaryButton`, `.cancelButton`, `.hashBox`.

- [ ] **Step 5: `TableList.module.css`**

Add `border-radius: var(--radius);` to: `.container`, `.searchInput`, `.refreshBtn`, `.copyBtn`, `.joinBtn`, `.retryBtn`, `.pageBtn`.
Do NOT touch `.badge`, `.count`, `.playerTrack`, `.playerFill` (keep their existing `999px`).

- [ ] **Step 6: Visual verification**

Restart the app, open Dashboard and click Deposit/Withdraw/Send to open each modal. Confirm all three modals, the GameWallet sidebar card, and the TableList's search/buttons/rows show 12px-rounded corners (badges/pills unchanged).

- [ ] **Step 7: Run baseline checks**

Run: `yarn tsc --noEmit 2>&1 | tail -5` — unchanged baseline.
Run: `yarn lint 2>&1 | tail -5` — unchanged baseline.
Run: `yarn vitest run 2>&1 | tail -15` — 110 passed / 9 files, unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/components/gameWallet/GameWallet.module.css src/components/modal/SendModal.module.css src/components/modal/WithdrawModal.module.css src/components/modal/DepositModal.module.css src/components/tableList/TableList.module.css
git commit -m "style: apply radius token to GameWallet, wallet modals, TableList chrome"
```

---

### Task 7: Delete dead Navbar files

**Files:**
- Delete: `src/components/navbar/Navbar.tsx`
- Delete: `src/components/navbar/Navbar.module.css`

**Interfaces:**
- None — this is pure cleanup, safe only because Task 3 already removed `Navbar`'s only usage.

- [ ] **Step 1: Confirm nothing still imports `Navbar`**

Run: `grep -rn "navbar/Navbar\"" src` (note the closing quote — this excludes `navbar/NetworkSelector`, which must NOT be deleted and lives in the same directory).
Expected: no output (zero matches). If anything matches, stop — do not delete, investigate the remaining reference first.

- [ ] **Step 2: Delete the two files**

```bash
git rm src/components/navbar/Navbar.tsx src/components/navbar/Navbar.module.css
```

- [ ] **Step 3: Confirm `NetworkSelector.tsx`/`.module.css` still exist and are untouched**

Run: `ls src/components/navbar/` — expect exactly `NetworkSelector.tsx` and `NetworkSelector.module.css` remaining in the directory.

- [ ] **Step 4: Run full verification**

Run: `yarn tsc --noEmit 2>&1 | tail -5` — unchanged baseline (confirms nothing still references the deleted files).
Run: `yarn lint 2>&1 | tail -5` — unchanged baseline.
Run: `yarn vitest run 2>&1 | tail -15` — 110 passed / 9 files, unchanged.
Restart the app (Task 1 Step 2's command) — confirm it still boots cleanly with the Sidebar in place.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: remove dead Navbar component, replaced by Sidebar"
```

---

### Task 8: Final whole-feature visual pass

**Files:** none (verification-only task, no code changes expected)

- [ ] **Step 1: Full restart**

Run the restart sequence from Task 1 Step 2.

- [ ] **Step 2: Walk every screen**

Visit `/` (Dashboard/Lobby), click into any available table (`/table/:id`), and `/wallet`. For each, confirm:
- Sidebar renders consistently (Lobby/Wallet active states correct, disabled items visibly non-interactive, NetworkSelector opens/closes/switches networks correctly, footer status chip shows the current network name and — once the Cosmos node responds — a live block height).
- Dark background (`hsl(240 33% 8%)`), purple accent, 12px-radius chrome throughout; pills/circles/mini-cards unchanged.
- No layout regressions: nothing overlaps the sidebar, Table page content isn't clipped or offset incorrectly (the Task 4 Step 1 fix), Dashboard header doesn't double up spacing oddly with the layout below it.

- [ ] **Step 3: Final baseline confirmation**

Run: `yarn tsc --noEmit 2>&1 | tail -5` — must equal the pre-existing baseline of 62 errors, not more.
Run: `yarn lint 2>&1 | tail -5` — must equal the pre-existing baseline of 27 warnings / 0 errors.
Run: `yarn vitest run 2>&1 | tail -15` — must show 110 passed / 9 files.

- [ ] **Step 4: No commit needed for this task** (verification only — if Step 2 surfaces an issue, fix it as part of whichever earlier task owns that file, with its own commit, then re-run this task's verification).

---
