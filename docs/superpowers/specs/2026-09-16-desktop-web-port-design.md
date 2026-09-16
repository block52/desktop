# Desktop web port — Stage 1 (wallet layer) design

## Context

`desktop` (`<repo>`) is an early-stage Electron Forge + Vite
app. `ui` (`../ui`, package `block52-poker-ui`) is the mature
React web frontend for the same Block52 poker platform — ~330 files, React 19 +
`react-router-dom` `BrowserRouter` + wagmi/viem/`@reown/appkit` +
`@block52/poker-vm-sdk`, on `vite@8`/`typescript@7`/`eslint@10` (flat config).

`desktop` was pinned on `vite@5.4`/`typescript@~4.5`/`eslint@8` during an earlier,
separate dependency upgrade (see git history) specifically to avoid this jump without
a reason to take it. Porting `ui` code into `desktop` is that reason.

There is no existing shared-code package between the two apps — `ui/packages/` only
holds `@block52/e2e` (Playwright) and `@block52/pvm-stub` (backend stub for e2e).

## Scope

**In scope (Stage 1, this spec):** the wallet layer only — generating/connecting a
wallet, viewing balance, sending, withdrawing. This is the subset `desktop` already
has a partial implementation of (`GameWallet.tsx`, `SendModal.tsx`,
`WithdrawModal.tsx`, `AppKitProvider.tsx`, `useCosmosWallet.ts`,
`utils/cosmos/{client,storage,urls}.ts`), so replacing/upgrading it is a smaller,
independently testable increment than the full player flow.

**Two wallet paths, both in scope:**
1. **Generated Cosmos wallet (primary).** An in-app wallet created on first use —
   mirrors `ui`'s `src/index.tsx` mnemonic-generation-on-load pattern via
   `@cosmjs/proto-signing`. This is the "no wallet found → Generate wallet" entry
   point shown in the Lobby screen of
   `claude.ai/artifact/RiALvNDa2Vu9xQWD24QBPD` (design updated mid-session — see
   that artifact for the current visual reference, it may continue to change).
   Used for deposits and joining tables.
2. **External wallet connect (secondary).** wagmi/Reown `AppKitProvider` flow
   already stubbed in `desktop` — likely for on-chain settlement/bridging, matches
   `ui`'s existing `useUserWalletConnect.ts`.

**Explicitly out of scope for this spec:**
- Table/game flow (`GameMessageBus`, `context/gameState/*`,
  `hooks/{game,playerActions}`, `components/playPage/*`) — Stage 2, separate spec.
  The "Available tables" list shown alongside the wallet panel in the current design
  artifact is visual context only for Stage 1 — not built until Stage 2.
- Admin/explorer surface (`/admin/*`, `/explorer/*`) — desktop app is for players,
  not operators; not planned.
- Guest mode ("Enter as guest" / "Guest" nav badge in the design artifact) —
  explicitly deferred by the user, not part of this port.
- A shared code package between `ui` and `desktop` — ported code becomes `desktop`'s
  own copy in `desktop/src`, adapted for Electron. The two codebases will diverge
  over time; fixes apply twice. Accepted tradeoff for now, revisit if divergence
  becomes painful.

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

Verify with `yarn install && yarn lint && yarn start` before any feature code changes,
same discipline as the earlier dependency-version upgrade in this repo (compare lint
output before/after; a pre-existing gap should stay a pre-existing gap, not silently
picked up as a "fix").

## Renderer adjustments

**Node-core polyfills.** `desktop/vite.renderer.config.ts` is currently empty
(`defineConfig({})`). `ui`'s `vite.config.ts` aliases `crypto→crypto-browserify`,
`stream→stream-browserify`, `buffer`, `process→process/browser.js`, `util`, `events`,
plus `define: { global: "globalThis", "process.env": {} }` — required because
`ethers`/wagmi/`@cosmjs` pull in Node built-ins that don't exist in Chromium, and
Electron's renderer is Chromium too (no `nodeIntegration`, per this repo's CLAUDE.md).
Copy the same aliases into `vite.renderer.config.ts`; without them the wallet code
will fail at runtime the moment it's ported in, not at build time.

**Routing.** Switch `desktop`'s router to `HashRouter` (`ui` uses `BrowserRouter`,
which is right for a served web app). `desktop/src/main.ts` already loads production
builds via `mainWindow.loadFile(...)` on `file://`. `HashRouter` avoids any
path-resolution edge case on relaunch or persisted route state, at zero cost since
there's no server-side routing to lose in a packaged app.

**Wallet-connect popups.** `desktop/src/main.ts`'s CSP already allowlists
`wss://relay.walletconnect.org`/`.com`, and `preload.ts` already exposes
`electronAPI.openExternal` wired to `shell.openExternal` via the `open-external` IPC
channel. The one gap: add
`mainWindow.webContents.setWindowOpenHandler(...)` in `main.ts` routing any
`window.open()` call (e.g. from Reown's Coinbase/WalletConnect modal) to
`shell.openExternal` — Electron denies `window.open` by default in a sandboxed
`BrowserWindow`, so without this handler those popups silently fail instead of
opening the user's browser.

`AppKitProvider.tsx` already mirrors `ui`'s Reown/wagmi setup closely (same
`createAppKit` pattern, wagmi adapter) — expect small adjustments, not a rewrite.

## Stage 1 file changes

**Port from `ui` (new to `desktop`):**
- `utils/cosmos/{settlementTx,signing,helpers,index}.ts`
- `hooks/wallet/useCosmosWallet.ts` (replaces `desktop`'s single-file version)
- `hooks/wallet/useUserWalletConnect.ts`

**Replace in `desktop` with `ui`'s more complete versions, adapted:**
- `GameWallet.tsx`, `SendModal.tsx`, `WithdrawModal.tsx`
- Adaptation is limited to anything assuming `BrowserRouter` or a served origin;
  `localStorage` usage in `ui`'s `NetworkContext.tsx`/`avatarStorage.ts` needs no
  change, it works the same in Electron's renderer.
- New: a "no wallet found → Generate wallet" empty state, per the design artifact's
  Lobby-screen wallet panel — doesn't exist yet in `desktop` or, per the ui survey,
  as a distinct component in `ui` either (`ui` generates the wallet unconditionally
  on load rather than gating it behind an empty-state panel). Treat this panel as
  new UI wrapping the existing generation logic, not a straight port.

**Env vars:** port the subset of `ui/.env.example`'s ~40 `VITE_*` keys Stage 1
actually needs (node RPC/WS URLs, treasury/BTCPay keys for withdrawals, etc.) —
`VITE_PROJECT_ID` already exists in `desktop/.env`. Precise key list is an
implementation-plan task, not enumerated here to avoid guessing at values.

## Testing

- Adopt `ui`'s `jest.config.js` pattern for unit tests on ported utils (mirrors
  `ui`'s `convertUtils.test.ts` style).
- No Playwright/e2e port for `desktop` in this phase.
- Manual verification per the existing project discipline: `yarn lint`, `yarn start`,
  exercise connect wallet → view balance → send → withdraw against whatever backend
  `ui` currently points at.

## Stage 2 (not detailed here)

Table/game flow: `bus/GameMessageBus.ts` + decorators, `context/gameState/*`,
`hooks/{game,player,playerActions}`, `components/playPage/*`. Gets its own spec once
Stage 1 is verified working, per the staged-sequencing decision.
