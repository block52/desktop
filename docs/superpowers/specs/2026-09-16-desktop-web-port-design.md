# Desktop web port — Stage 1 (Web3 deposit) design

## Revision note

This spec originally assumed `desktop`'s wallet layer was an early, partial
implementation that needed `ui`'s "more complete" version ported in. Reading both
codebases in full (not just file names) during plan-writing showed that premise was
wrong: `desktop` already has a working generate/import wallet flow, send, and a
fully-implemented two-step Cosmos→Ethereum bridge withdrawal (`WithdrawModal.tsx`) —
in places more advanced than `ui`, which has no equivalent send/withdraw modals at
all. The one real gap is **deposits**: `desktop`'s "Deposit" button just navigates to
the wallet generation page: there is no deposit UI. This revision rescopes Stage 1
to that actual gap. Sections below replace the original scope/file-changes content.

## Context

`desktop` (`<repo>`) is an Electron Forge + Vite app with a
substantially-built Cosmos wallet layer already in place: `NetworkContext`,
`useCosmosWallet`, a `GameWallet` dashboard panel, a `/wallet` page for
generate/import with seed-phrase display, `SendModal`, and `WithdrawModal` (a full
two-step bridge: initiate on Block52/Cosmos chain → poll for validator signature →
complete via `useWriteContract` against the bridge contract on Ethereum).

`ui` (`../ui`, package `block52-poker-ui`) is the mature React
web frontend for the same platform — ~330 files, React 19 + `react-router-dom` +
wagmi/viem/`@reown/appkit` + `@block52/poker-vm-sdk`, on
`vite@8`/`typescript@7`/`eslint@10` (flat config). Its wallet UI is structured
differently from `desktop`'s (`WalletPanel.tsx` + `CosmosWalletPage.tsx`, no
send/withdraw modals), but it has a deposit flow `desktop` lacks entirely: ERC20
approve+deposit into the same bridge contract `desktop`'s `WithdrawModal` already
talks to (`BRIDGE_ADDRESS = 0xE4E22A524f2b104cB71fB154f72736bd02722fF4`, confirmed
identical in both codebases).

`desktop` was pinned on `vite@5.4`/`typescript@~4.5`/`eslint@8` during an earlier,
separate dependency upgrade specifically to avoid that jump without a reason to take
it. Porting the deposit flow's dependencies (wagmi hooks already used elsewhere in
`desktop`, no new toolchain requirement per se) doesn't strictly require the bump,
but `desktop`'s `.eslintrc.json`/`tsconfig.json` are looser than `ui`'s
(`noImplicitAny` only vs `strict: true`), and matching `ui`'s tooling keeps the two
codebases easier to compare/port between going forward. Kept in scope as a
prerequisite task.

There is no shared-code package between the two apps — `ui/packages/` only holds
`@block52/e2e` (Playwright) and `@block52/pvm-stub` (backend stub for e2e). Ported
code becomes `desktop`'s own copy, adapted for Electron; the two codebases diverge
over time, fixes apply twice. Accepted tradeoff, per the earlier code-sharing
decision.

## Scope

**In scope (Stage 1): Web3 direct deposit only.** ERC20 approve + deposit of
USDC/USDT from a connected Ethereum wallet into the bridge contract, minting the
equivalent to the user's Cosmos wallet address. This mirrors `WithdrawModal`'s
existing bridge pattern in reverse, and needs no new backend dependency — it's
wagmi/viem contract calls against infrastructure `desktop` already integrates with.

**Explicitly out of scope for this spec:**
- **"Pay with Crypto" (BTCPay) deposit path.** `ui`'s `DepositCore.tsx` bundles a
  second deposit method: a third-party payment processor flow requiring
  `PaymentApiContext` (a backend payment-session API `desktop` has no client for),
  QR code display, and payment-status polling. Explicitly deferred — separate piece
  of work if/when a backend payment-session endpoint exists for `desktop` to call.
- `ProfileAvatarContext` coupling. `ui`'s `DepositCore.tsx` calls
  `refreshWalletNfts()` from `ProfileAvatarContext` on wallet connect — an
  NFT/avatar-profile side effect unrelated to depositing funds. Not ported;
  `desktop` has no avatar/profile system and none is being added here.
- Table/game flow, admin/explorer surface, guest mode, a shared `ui`/`desktop`
  package — all as previously scoped out (unchanged from the original spec).
- The landing/lobby visual designs shared during brainstorming
  (`claude.ai/artifact/RiALvNDa2Vu9xQWD24QBPD`) — visual reference only, not
  something this spec implements; `desktop`'s dashboard already has its own
  layout (`GameWallet` sidebar + `TableList` main panel) that the deposit UI
  slots into.

## Toolchain upgrade (prerequisite, before any feature code moves)

Bump `desktop`'s tooling to match `ui`:
- `vite`: `^5.4.21` → `^8.1.4`
- `typescript`: `~4.5.4` → `^7.0.2`
- `eslint`: `^8.57.1` → `^10.x`; replace `@typescript-eslint/{eslint-plugin,parser}`
  with the combined `typescript-eslint` package `ui` uses
- Migrate `desktop/.eslintrc.json` → flat `eslint.config.mjs`, adapted from `ui`'s
  (includes `eslint-plugin-react-hooks@7`, `eslint-plugin-react-refresh`)
- Tighten `desktop/tsconfig.json` to match `ui`'s `strict: true`,
  `noUnusedLocals`/`noUnusedParameters`, `moduleDetection: "force"` (`desktop`'s
  current config only sets `noImplicitAny`)

Verify with `yarn install && yarn lint && yarn start` before any feature code changes
— compare lint output before/after; a pre-existing gap should stay a pre-existing
gap, not silently picked up as a "fix" (same discipline as the earlier
dependency-version upgrade in this repo).

## Renderer adjustment

**Node-core polyfills.** `desktop/vite.renderer.config.ts` is currently empty
(`defineConfig({})`). The deposit code adds no new Node-core-dependent imports
beyond what `WithdrawModal.tsx` already uses successfully (`wagmi`/`viem` contract
calls) — so this is lower-risk than originally assessed, but `ui`'s
`vite.config.ts` polyfill aliases (`crypto`, `stream`, `buffer`, `process`, `util`,
`events` → their browserify/polyfill equivalents, plus
`define: { global: "globalThis" }`) should still be added defensively, since the new
`erc20ABI`/`bigunit`-based amount conversion is new surface area. Verify with
`yarn start` after the deposit code lands, not just at toolchain-upgrade time.

Routing and wallet-popup handling are **not** touched by this spec: `desktop`
already uses `MemoryRouter` (not `BrowserRouter`), and `WithdrawModal.tsx`'s
existing `openAppKit()` call already works in production-quality code without any
`setWindowOpenHandler` — no observed problem to fix.

## Stage 1 file changes

**New files, ported from `ui` (self-contained, no `PaymentApiContext`/
`ProfileAvatarContext` dependency):**
- `src/hooks/wallet/useDepositUSDC.ts` — wraps `useWriteContract`/
  `useWaitForTransactionReceipt` for the bridge contract's `depositUnderlying`
  (USDC direct) and `deposit` (any ERC20, auto-swaps) functions.
- `src/hooks/wallet/useApprove.ts` — ERC20 `approve()` via `useWriteContract`.
- `src/hooks/wallet/useAllowance.ts` — ERC20 `allowance()` via `useReadContract`.
- `src/hooks/wallet/useDecimals.ts` — ERC20 `decimals()` via `useReadContract`,
  defaults to 6 (USDC standard) while loading.
- `src/hooks/wallet/useWalletBalance.ts` — ERC20 `balanceOf()` via
  `useReadContract`.
- `src/abis/erc20ABI.ts` — standard ERC20 ABI (`approve`, `allowance`, `decimals`,
  `balanceOf`, `transfer`, `transferFrom`, `Approval`/`Transfer` events).

**Modified existing file:**
- `src/abis/contractABI.ts` — add a `depositAbi` (`depositUnderlying(uint256,
  string)`, `deposit(uint256, string, address)`) alongside the existing
  `withdrawAbi`/`BRIDGE_ADDRESS` (same contract, same address, already present).

**New constants** (`desktop` has no `config/constants.ts` equivalent yet — add one):
- `ETH_CHAIN_ID = 1`, `ETH_USDC_ADDRESS`, `ETH_USDT_ADDRESS` — same values as `ui`'s
  `src/config/constants.ts`.

**New dependency:** `bigunit` (`^1.2.5`, matches `ui`'s version) — for
`convertAmountToBigInt`, the decimal-to-bigint conversion `ui` uses for deposit
amounts. Ported alongside it rather than reimplemented, since the existing
implementation carries deliberate precision-safety handling.

**New UI, adapted from `ui`'s `DepositCore.tsx` (Web3 half only — the
`depositMethod === "usdc"` branch, method selector and crypto-payment branch
dropped):**
- New component (exact path/name decided in the implementation plan) rendering:
  token selector (USDC/USDT), Web3 wallet connect status (reuses `desktop`'s
  existing `useAppKit`/`useAppKitAccount` pattern already in `GameWallet.tsx`/
  `WithdrawModal.tsx` — no need for `ui`'s separate `useUserWalletConnect`
  wrapper), amount input, approve/deposit button pair, and the Cosmos-address
  destination display (`cosmosWallet.address`, "b52USDC will be minted to your
  Block52 address").
- Wired into `Dashboard.tsx`'s existing `onDeposit` prop (currently
  `goToWallet`) — opens this new deposit modal/panel instead of navigating to
  `/wallet`.

## Testing

- Unit tests for the new hooks/utils following `desktop`'s existing pattern
  (`src/utils/convertUtils.test.ts` is the closest precedent in this repo).
- Manual verification: `yarn lint`, `yarn start`, exercise connect Web3 wallet →
  approve → deposit → confirm Cosmos balance increases (via `useCosmosWallet`'s
  existing `refreshBalance`).

## Stage 2 (not detailed here)

Table/game flow: `bus/GameMessageBus.ts` + decorators, `context/gameState/*`,
`hooks/{game,player,playerActions}`, `components/playPage/*`. Gets its own spec once
Stage 1 is verified working, per the staged-sequencing decision. The BTCPay deposit
path (explicitly out of scope above) is a candidate for its own future spec, separate
from Stage 2.
