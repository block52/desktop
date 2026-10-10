# Wallet Page Mock Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Realign the Wallet page (`/wallet`) with the mock's wallet screen — "Available" balance card with Deposit/Withdraw segmented control, an Activity list backed by real withdrawal-request data, and the existing key-management sections moved below the fold — while keeping every real flow (web3 bridge deposit/withdraw, cosmos send, seed management) intact.

**Architecture:** Page becomes: header → 2-col grid (Available card | Deposit/Withdraw action card slot) → Activity panel → NFT gallery → wallet-keys cards. The complex bridge flows stay in the existing `DepositModal`/`WithdrawModal` (opened from the segmented control) — embedding their multi-step wagmi state machines inline would duplicate logic. New data source: `useWithdrawalActivity` hook polling `client.listWithdrawalRequests(address)`. `GameWallet` becomes orphaned and is deleted (only `Wallet.tsx` imports it).

**Tech Stack:** React 19 + CSS modules, vitest + @testing-library/react (jsdom pragma — deps already installed 2026-10-10).

**Spec:** `~/Downloads/Block52 Redesign.html` wallet screen (`<sc-if value="{{ isWallet }}">` block); tokens/values quoted verbatim below. Standing rule from CLAUDE.md: mock-check after completion.

## Global Constraints

- Package manager: yarn. Test runner: `yarn test` (node env; jsdom via `// @vitest-environment jsdom` pragma + explicit `afterEach(cleanup)`).
- Dark tokens (exact): pane `hsl(240 26% 11%)`, border `hsl(245 22% 17%)`, muted `rgb(148,163,184)` / `hsl(215 20% 65%)`, foreground `hsl(210 40% 98%)`, success `hsl(142 70% 62%)`, warning fg `hsl(43 90% 66%)`, accent `hsl(263 83% 58%)`, pane-hover `hsl(245 25% 14%)`.
- Fonts: Inter stack; `var(--mono)` for addresses/numbers in list cells.
- **No `||`/`??` fallbacks for SDK values** (repo rule) — normalize explicitly instead.
- Mock items with NO real data source (do NOT fabricate): "At tables" row (would need per-game state fetches), "Lifetime net", deposit-side Activity (ETH log enumeration out of scope). Documented divergences.
- Verification per task: `yarn test`, `yarn lint`, `npx tsc --noEmit` (pre-existing errors in main.ts/convertUtils.test.ts are not ours). NO git commits — the tree carries unrelated uncommitted WIP; leave everything in the working tree.
- After all tasks: compare visually against the mock (screenshot or `yarn start`) and report per the standing rule.

---

### Task 1: `useWithdrawalActivity` hook (TDD)

**Files:**
- Create: `src/hooks/useWithdrawalActivity.ts`
- Test: `src/hooks/useWithdrawalActivity.test.tsx`

**Interfaces:**
- Produces:
  - `interface WithdrawalActivityItem { nonce: string; toAddress: string; amountMicro: string; status: "pending" | "signed" | "completed"; createdAt: number | null }`
  - `normalizeWithdrawal(raw: unknown): WithdrawalActivityItem | null` (null for malformed entries)
  - `useWithdrawalActivity(address: string | null, pollMs?: number): { items: WithdrawalActivityItem[]; isLoading: boolean; error: string }` — polls `getCosmosClient({rpc,rest}).listWithdrawalRequests(address)` via `useNetwork()` endpoints; newest first (by createdAt desc, nulls last); skips silently when address is null or client is null.

- [ ] **Step 1: Write the failing test** — `src/hooks/useWithdrawalActivity.test.tsx`:

```tsx
// @vitest-environment jsdom
import React, { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { normalizeWithdrawal, useWithdrawalActivity } from "./useWithdrawalActivity";
import { getCosmosClient } from "../utils/cosmos/client";
import { useNetwork } from "../context/NetworkContext";

vi.mock("../utils/cosmos/client", () => ({ getCosmosClient: vi.fn() }));
vi.mock("../context/NetworkContext", () => ({ useNetwork: vi.fn() }));

const mockedGetCosmosClient = vi.mocked(getCosmosClient);
const mockedUseNetwork = vi.mocked(useNetwork);

const wrapper = ({ children }: { children: ReactNode }) => <>{children}</>;

function mockClient(withdrawals: unknown[]) {
    mockedUseNetwork.mockReturnValue({ currentNetwork: { name: "t", rpc: "r", rest: "e" } } as never);
    mockedGetCosmosClient.mockReturnValue({ listWithdrawalRequests: vi.fn().mockResolvedValue(withdrawals) } as never);
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
});

describe("normalizeWithdrawal", () => {
    it("maps a signed request", () => {
        expect(normalizeWithdrawal({ nonce: "n1", base_address: "0xABC", amount: "5000000", status: "signed", created_at: 1700000000 })).toEqual({
            nonce: "n1", toAddress: "0xABC", amountMicro: "5000000", status: "signed", createdAt: 1700000000
        });
    });

    it("maps completed/claimed statuses to completed", () => {
        for (const s of ["completed", "claimed"]) {
            expect(normalizeWithdrawal({ nonce: "n", base_address: "0xA", amount: "1", status: s })?.status).toBe("completed");
        }
    });

    it("maps any other status to pending", () => {
        expect(normalizeWithdrawal({ nonce: "n", base_address: "0xA", amount: "1", status: "pending" })?.status).toBe("pending");
        expect(normalizeWithdrawal({ nonce: "n", base_address: "0xA", amount: "1" })?.status).toBe("pending");
    });

    it("returns null for malformed entries", () => {
        expect(normalizeWithdrawal(null)).toBeNull();
        expect(normalizeWithdrawal({})).toBeNull();
        expect(normalizeWithdrawal({ nonce: "n" })).toBeNull();
    });

    it("accepts string or number created_at, else null", () => {
        expect(normalizeWithdrawal({ nonce: "n", base_address: "0xA", amount: "1", created_at: "1700000000" })?.createdAt).toBe(1700000000);
        expect(normalizeWithdrawal({ nonce: "n", base_address: "0xA", amount: "1" })?.createdAt).toBeNull();
    });
});

describe("useWithdrawalActivity", () => {
    it("returns normalized items newest-first", async () => {
        mockClient([
            { nonce: "old", base_address: "0xA", amount: "1", status: "completed", created_at: 100 },
            { nonce: "new", base_address: "0xB", amount: "2", status: "pending", created_at: 200 }
        ]);
        const { result } = renderHook(() => useWithdrawalActivity("b52addr"), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.items.map(i => i.nonce)).toEqual(["new", "old"]);
        expect(result.current.error).toBe("");
    });

    it("sets error when the client call rejects", async () => {
        mockedUseNetwork.mockReturnValue({ currentNetwork: { name: "t", rpc: "r", rest: "e" } } as never);
        mockedGetCosmosClient.mockReturnValue({ listWithdrawalRequests: vi.fn().mockRejectedValue(new Error("boom")) } as never);
        const { result } = renderHook(() => useWithdrawalActivity("b52addr"), { wrapper });
        await waitFor(() => expect(result.current.error).toBe("boom"));
    });

    it("does nothing when address is null", () => {
        const { result } = renderHook(() => useWithdrawalActivity(null), { wrapper });
        expect(result.current.items).toEqual([]);
        expect(result.current.isLoading).toBe(false);
        expect(mockedGetCosmosClient).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run to verify RED** — `yarn test src/hooks/useWithdrawalActivity.test.tsx` → module not found.

- [ ] **Step 3: Implement** — `src/hooks/useWithdrawalActivity.ts`:

```ts
import { useEffect, useRef, useState } from "react";
import { useNetwork } from "../context/NetworkContext";
import { getCosmosClient } from "../utils/cosmos/client";

export type WithdrawalStatus = "pending" | "signed" | "completed";

export interface WithdrawalActivityItem {
    nonce: string;
    toAddress: string;
    amountMicro: string;
    status: WithdrawalStatus;
    createdAt: number | null;
}

const COMPLETED_STATUSES = new Set(["completed", "claimed"]);

export function normalizeWithdrawal(raw: unknown): WithdrawalActivityItem | null {
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.nonce !== "string" || typeof r.base_address !== "string" || typeof r.amount !== "string") return null;

    const rawStatus = typeof r.status === "string" ? r.status : "pending";
    const status: WithdrawalStatus = COMPLETED_STATUSES.has(rawStatus) ? "completed" : rawStatus === "signed" ? "signed" : "pending";

    const createdRaw = r.created_at;
    const createdAt = typeof createdRaw === "number" ? createdRaw : typeof createdRaw === "string" && createdRaw !== "" ? Number(createdRaw) : null;

    return { nonce: r.nonce, toAddress: r.base_address, amountMicro: r.amount, status, createdAt: createdAt !== null && Number.isFinite(createdAt) ? createdAt : null };
}

export function useWithdrawalActivity(address: string | null, pollMs = 10000): { items: WithdrawalActivityItem[]; isLoading: boolean; error: string } {
    const { currentNetwork } = useNetwork();
    const [items, setItems] = useState<WithdrawalActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const itemsRef = useRef(items);
    itemsRef.current = items;

    useEffect(() => {
        if (address === null) return;
        let cancelled = false;

        const load = async () => {
            try {
                const client = getCosmosClient(currentNetwork);
                if (!client) return;
                const raw: unknown[] = await client.listWithdrawalRequests(address);
                if (cancelled) return;
                const normalized = raw
                    .map(normalizeWithdrawal)
                    .filter((i): i is WithdrawalActivityItem => i !== null)
                    .sort((a, b) => (b.createdAt ?? -1) - (a.createdAt ?? -1));
                setItems(normalized);
                setError("");
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load activity");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        setIsLoading(true);
        void load();
        const interval = setInterval(load, pollMs);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [address, currentNetwork, pollMs]);

    return { items, isLoading, error };
}
```

- [ ] **Step 4: Run to verify GREEN** — 8 tests pass. Then `yarn lint` + `npx tsc --noEmit` clean on the new files.

---

### Task 2: `AvailableCard` component (TDD)

**Files:**
- Create: `src/components/wallet/AvailableCard.tsx`
- Create: `src/components/wallet/AvailableCard.module.css`
- Test: `src/components/wallet/AvailableCard.test.tsx`

**Interfaces:**
- Consumes: nothing (props only). Segmented control uses global `.segmented`/`.seg` classes from `src/index.css`.
- Produces: `AvailableCard` default export; props `{ usdcBalanceMicro: string; pendingWithdrawalMicro: string; address: string; web3Address: string | null; isWeb3Connected: boolean; onDeposit: () => void; onWithdraw: () => void; onSend: () => void; onConnectWeb3: () => void; onManageWeb3: () => void }`.

Mock structure (verbatim values): pane-lite card padding 22px col gap 18px; header row space-between (section-label "Available" + mono 11.5px muted `b52…7f3a`-style short address = first 3 chars + `…` + last 4); balance row (USDC icon 30px + `$xx.xx` 700 40px ls -0.02em); breakdown block (border-top 1px border, padding-top 14px, col gap 10px, rows: label 400 13px muted, value num 13px foreground) — one real row: "Pending withdrawal" `-$x.xx`; segmented `Deposit`/`Withdraw` (`.seg on` toggling, mock wDep/wWd pattern); then a Web3 row: connected → mono address short + "Manage" ghost pill, disconnected → "Connect Web3 Wallet" ghost pill; Send as a ghost pill after segmented (functional addition, mock lacks it — documented).

- [ ] **Step 1: Failing test** — `AvailableCard.test.tsx`: (1) renders balance formatted `$12.30` from `"12300000"` micro; (2) renders pending withdrawal `-$5.00` from `"5000000"`; (3) clicking Deposit/Withdraw fires callbacks and toggles `.seg on`; (4) shows Connect Web3 Wallet when disconnected and Manage when connected. Use `data-testid` only where semantic queries are awkward (none needed — text queries suffice).

- [ ] **Step 2: RED, Step 3: implement, Step 4: GREEN** per component pattern already established in this repo (see `src/components/nft/NftGallery.tsx` for the file skeleton, `src/components/gameWallet/GameWallet.tsx:51` for the `truncate` helper pattern: `${addr.slice(0, 6)}...${addr.slice(-4)}` — card header uses first-3/last-4 per mock).

CSS (module) keys: `.card { padding: 22px; display flex column gap 18px }`, `.cardHead { display:flex; justify-content:space-between; align-items:center }`, `.headAddress { font-family: var(--mono); font-size: 11.5px; color: muted }`, `.balanceRow { display:flex; align-items:center; gap:12px }`, `.usdcIcon { width:30px; height:30px }`, `.balanceAmount { font: 700 40px/1 Inter...; letter-spacing:-0.02em; color: var(--text) }`, `.breakdown { border-top:1px solid hsl(245 22% 17%); padding-top:14px; display:flex; flex-direction:column; gap:10px }`, `.breakdownRow { display:flex; justify-content:space-between; font: 400 13px/1 Inter; color: muted }`, `.breakdownValue { font-family: var(--mono)... color: var(--text) }`, `.actionsRow { display:flex; align-items:center; gap:10px; flex-wrap:wrap }`, `.web3Row { display:flex; align-items:center; gap:10px; border-top:1px solid hsl(245 22% 17%); padding-top:14px }`, ghost pill class `.pill { height:36px; padding:0 14px; border-radius:999px; font:500 13px/1 Inter; display:inline-flex; align-items:center; }` composed with global `btn-ghost`.

USDC icon: reuse `import usdcUrl from "../../assets/lobby/usdc.svg"` (same asset `Dashboard.tsx:12` uses).

- [ ] **Step 5: Verify** `yarn test src/components/wallet/AvailableCard.test.tsx`, lint, tsc.

---

### Task 3: `ActivityPanel` component (TDD)

**Files:**
- Create: `src/components/wallet/ActivityPanel.tsx`
- Create: `src/components/wallet/ActivityPanel.module.css`
- Test: `src/components/wallet/ActivityPanel.test.tsx`

**Interfaces:**
- Consumes: `useWithdrawalActivity` (Task 1), `useCosmosWallet` is NOT used here — panel takes `address: string` prop.
- Produces: `ActivityPanel` default export, props `{ address: string }`.

Mock structure (verbatim): section title `font:600 20px/1.3 Inter`; pane-lite `overflow:hidden`; header grid desktop `minmax(0,1fr) minmax(0,1.6fr) 110px 100px` gap 12 padding `12px 20px` border-bottom: labels Type / Detail / Status / Amount(right-aligned); rows same grid, min-height 58px padding `12px 20px` border-bottom `1px solid hsl(245 22% 17% / .6)`: Type col = kind 600 13.5px + time 400 11.5px muted (`new Date(createdAt*1000).toLocaleString()` when non-null, else "—"); Detail = mono 12px muted truncated `To {shortAddr}` + ` · nonce {nonce.slice(0,6)}`; Status pill = 600 10.5px ls .06em padding 5px 8px radius 999: completed → bg `hsl(142 70% 45.3% / .12)` fg `hsl(142 70% 66%)` text "COMPLETED"; signed → bg `hsl(263 83% 58% / .14)` fg `hsl(263 90% 78%)` text "READY"; pending → bg `hsl(43 90% 66% / .14)` fg `hsl(43 90% 66%)` text "PENDING"; Amount = 600 14px right, `-$x.xx` (micro → $ via `/1e6` `toFixed(2)`), muted when pending else foreground. Loading → spinner reuse (`.spinner` keyframe pattern from `src/pages/blockExplorer/BlockExplorer.module.css:240-253`); empty → "No activity yet."; error → error text.

- [ ] **Step 1: Failing test** — mock `../../hooks/useWithdrawalActivity` with `vi.mock`; cases: (1) renders a completed withdrawal row with `-$5.00` and COMPLETED pill; (2) renders PENDING pill for pending; (3) empty state when items `[]` and not loading; (4) error state. GREEN via component + CSS (same patterns as Task 2).

---

### Task 4: Restructure `Wallet.tsx` + delete `GameWallet`

**Files:**
- Modify: `src/pages/Wallet.tsx` (full restructure)
- Modify: `src/pages/Wallet.module.css` (add `.grid`, `.keysSection` styles)
- Delete: `src/components/gameWallet/` (both files — orphaned after this)

**Interfaces:**
- Consumes: AvailableCard, ActivityPanel, NftGallery, DepositModal, WithdrawModal, SendModal, existing generate/import/keys JSX (unchanged internals).
- No new exports.

- [ ] **Step 1: Restructure.** New page layout (wallet exists): header (title "Wallet" + subtitle — real copy: "Your on-chain USDC balance. Deposit from your Web3 wallet, withdraw any time.") → `div.styles.grid` (`grid-template-columns: repeat(auto-fit, minmax(min(100%,300px),1fr)); gap:14px`) containing `AvailableCard` (left) — right slot: `NftGallery` moved UP from below (grid column 2) → section title "Activity" + `ActivityPanel` full width → "Wallet keys" section-label + existing Current Wallet card (address/seed/clear, unchanged) → Generate/Import cards (existing, unchanged, only when `!existingAddress`).

Balance derivation in `Wallet.tsx`: `usdcBalanceAmount` (existing, micro string) minus pending withdrawals is NOT computed — `AvailableCard` receives `usdcBalanceMicro={usdcBalanceAmount}` and `pendingWithdrawalMicro` from a `useWithdrawalActivity(existingAddress)` instance (the ActivityPanel has its own instance; sharing one instance via a second hook call is fine — both poll the same endpoint, 10s interval, acceptable duplication) — sum of items with status `"pending"` amounts via `reduce` on `BigInt` (guard empty list → `"0"`).

Modal wiring: `onDeposit` → `setShowDepositModal(true)`; `onWithdraw` → `setShowWithdrawModal(true)`; `onSend` → `setShowSendModal(true)`; web3 props threaded from `useAppKit()`/`useAppKitAccount()` in Wallet.tsx (same calls GameWallet made: `open: openAppKit`, `address: web3Address`, `isConnected: isWeb3Connected`).

No-wallet state (`!existingAddress`): unchanged Generate/Import cards only.

- [ ] **Step 2: Delete `src/components/gameWallet/`** — verify `grep -r "gameWallet\|GameWallet" src/` returns nothing after Step 1.

- [ ] **Step 3: Verify** `yarn test` (all), `yarn lint` (0 errors), `npx tsc --noEmit` clean on touched files. NO commit.

---

### Task 5: Mock verification (standing rule)

- [ ] **Step 1:** App is already running (`yarn start` task `bash-xsxepkv9`, HMR applies). Screenshot the Wallet page via kimi-cu; compare element-by-element against the mock wallet screen (card paddings, 40px balance, pill shapes, activity grid columns, status pill colors).
- [ ] **Step 2:** Fix any token/layout mismatches found; re-verify; report the comparison + documented divergences (Send button, mock rows without data sources, flows stay in modals, keys section below fold, NFT moved into grid).

## Self-Review

**Spec coverage:** mock wallet screen elements → Available card (Task 2), Copy-address pattern already exists in keys card (pre-existing), Activity (Tasks 1+3), segmented Deposit/Withdraw (Task 2). Mock-only-no-data items documented, not built.
**Placeholder scan:** all code blocks complete; no TBD steps.
**Type consistency:** `WithdrawalActivityItem` fields identical across Task 1/3/4; `AvailableCard` props match Task 4 call sites; `useWithdrawalActivity(address)` signature consistent.
