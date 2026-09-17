# Desktop web port — Stage 2a (core playable table) design

## Context

Stage 1 (Web3 deposit flow) is merged to `main`. This is Stage 2 of the same
web-to-desktop port: the table/game flow — actually playing poker hands, not
just finding tables (`TableList`/`useFindGames`, already merged, unaffected by
this spec).

`ui` (`../ui`)'s table/game flow is a large, mature
system, not a thin wrapper:
- A raw `WebSocket` in `context/GameStateContext.tsx` connects to
  `${currentNetwork.ws}?tableAddress=...&playerId=...`, authenticated the same
  way deposit/withdraw already sign Cosmos transactions (`createAuthPayload()`
  from `utils/cosmos/signing`).
- `bus/GameMessageBus.ts` (597 lines) ingests raw WS messages, derives typed
  `GameEvent`s by diffing snapshots, and splits into two tracks: a **logical
  track** (fed synchronously at ingest, drives correctness — whose turn is it,
  what's legal) and a **render track** (paced via decorators —
  `actionBadge`/`communityCardStagger`/`coalesceCatchUp`/`showdownHold`/
  `remoteActionSound` — backpressure, coalescing, `minDisplayMs`/
  `holdPreviousMs` — purely visual smoothing). Comments reference "Phase 1–5"
  of engineering on this file alone.
- State fans out into 5 React contexts (`context/gameState/{GameData,GameMeta,
  GameUI,Replay,GameActions}Context.tsx`) so consumers only re-render on the
  slice they use.
- ~15 player-action hooks (`hooks/playerActions/*`) all submit through one
  `executeTransportAction`, over the **Cosmos signing-client path** — the same
  infrastructure `desktop`'s wallet/withdraw code already exercises
  successfully, **not** over the websocket.
- A large `components/playPage/` tree: `Table.tsx` root, seating/board/action-
  button/header/sidebar/pot-display/status-message components, per-player
  components, card components, turn/win animations, SNG-specific modals.

`desktop`'s current state: `TableList`/`useFindGames` (discovery half) already
work. **Zero** websocket/message-bus/game-state infrastructure exists anywhere
in `desktop/src`. `src/pages/table/Table.tsx` is a literal 9-line placeholder
(`<div>Table {id}</div>`). `NetworkContext.tsx` already defines a `ws` field
per network preset, with a doc comment anticipating this work, but nothing
reads it yet.

This is a materially bigger, more architecturally involved build than Stage
1's deposit flow (which was five hooks and one modal). Given the size, this
spec covers **Stage 2a only**: a core playable cash-game table. Stage 2b
(choreography/polish) is a separate future spec.

## Scope

**In scope (Stage 2a):**
- WebSocket connection to the game server for a joined cash-game table.
- A simplified ingest pipeline: raw snapshot → typed event → immediate state
  update. No animation pacing, no decorators, no backpressure/coalescing —
  state snaps directly to server truth.
- One unified game-state context (not `ui`'s 5-slice split) — simpler to
  build and reason about for a first version; split later only if profiling
  shows a real re-render cost (YAGNI).
- Manual player actions: bet, call, raise, check, fold, join table, leave
  table, sit in, sit-in-and-wait, sit out, muck cards, show cards.
- Auto-only game-loop actions (no button — fired by the app itself when it's
  this player's turn and the action is legal): post small blind, post big
  blind, deal cards, start new hand. **These are required, not deferrable** —
  confirmed by reading `ui`'s code that none of these four have any manual UI
  at all; without an auto-trigger for them a hand can never start or advance,
  regardless of whether every betting button works.
- `usePlayerLegalActions`-equivalent logic: computing which action buttons
  are enabled at any point from the current table/hand state.
- All actions submit via the same Cosmos signing-client path `desktop`'s
  wallet/withdraw code already uses (mirrors `ui`'s `executeTransportAction`)
  — not over the websocket.
- Real component breakdown matching `ui`'s boundaries (these are genuinely
  separable pieces of one screen, not premature abstraction): `Table.tsx`
  root, `PlayerSeating`, `TableBoard`, `PlayerActionButtons`, `TableHeader`,
  `TableSidebar`, pot display, status messages, `Player`/`OppositePlayer`/
  `VacantPlayer`, card components, `NoWalletOverlay`, `TableErrorPage`.
  `NoWalletOverlay`/`TableErrorPage` are baseline robustness (no wallet /
  connection-error states), not polish — in scope for 2a.
- Cash games only. Sit & Go tables stay visible/joinable-looking in
  `TableList` but aren't actually playable until 2b.

**Prerequisite (before any feature code):** `desktop/src/main.ts`'s CSP
`connect-src` currently only allowlists `ws://localhost:*`/`wss://
localhost:*` and the WalletConnect relay — not the production `wss://
node1.block52.xyz/ws` / `wss://node.texashodl.net/ws` endpoints
`NetworkContext.tsx` already defines. A real WebSocket connection to those
hosts is CSP-blocked today. This needs updating regardless of any other
scope decision in this spec.

**Explicitly out of scope for Stage 2a (candidates for Stage 2b, separate
spec):**
- The full `GameMessageBus` choreography: decorators, backpressure,
  coalescing, render-track pacing. All animation/sound smoothing.
- `TurnAnimation`/`WinAnimation` components.
- Sit & Go support: `SitAndGoWaitingModal`, `SngPayoutPanel`, `claimWinnings`
  (SNG/tournament-only prize claiming — confirmed manual, wired specifically
  to SNG payout UI, not part of core cash-game betting flow).
- Timeout-based auto-fallbacks layered on top of already-working manual
  actions: `useAutoFold`, `useAutoMuck`, `useAutoShowCards` (these exist in
  `ui` as safety nets, not replacements — the manual fold/muck/show actions
  work without them).
- `useAutoSitOutNextBB` (scheduling nuance, not needed for a hand to play).
- Hand history / replay (`Replay` context in `ui`) — a review feature, not
  needed to play a hand. Out of scope entirely, not just deferred.
- `ui`'s 5-slice context split — accepted as a possible future refactor, not
  built now.
- Admin/explorer surface — already out of scope per Stage 1, unchanged.

## Architecture

**WebSocket connection.** A `GameStateProvider` (or similarly-named context
provider) owns the `WebSocket` lifecycle for a joined table: connect on
mount/table-join using `currentNetwork.ws` + the table ID, authenticate the
same way `ui` does (`createAuthPayload()`-equivalent using the existing
Cosmos signing utilities `desktop` already has), subscribe, and clean up
(unsubscribe/close) on unmount/leave. Reconnection-on-drop behavior: mirror
whatever `ui` does at a basic level (exact mechanism to be confirmed during
planning by reading `ui`'s connection-management code, not guessed here).

**Ingest pipeline.** A plain-TypeScript module (no React/browser dependency
beyond what's already portable, matching `ui`'s `GameMessageBus.ts` which has
none beyond an optional `performance.now()`) that: receives raw WS messages,
classifies them, derives typed game events by diffing the previous snapshot
against the new one, and immediately dispatches the resulting state update.
No decorators, no queue, no pacing — this is the "logical track" only. Task-
level design (exact module name/shape, how much of `deriveEvents.ts`'s event-
derivation logic to port vs. re-derive) is an implementation-plan concern.

**State.** One unified context/reducer (not 5 slices) holding table state,
hand state, player states, and legal-action state. Read via a single hook
(name TBD in planning) rather than `ui`'s per-slice hooks.

**Actions.** A single submission path (mirroring `executeTransportAction`)
that all action hooks funnel through, using the existing Cosmos
signing-client (`getSigningClient`/`createSigningClientFromMnemonic`,
already used by `desktop`'s withdraw/wallet code) — not the websocket. Legal-
action computation reads the unified state to determine which buttons are
enabled.

**Auto-trigger layer.** A small effect-based layer that watches state and
fires `postSmallBlind`/`postBigBlind`/`dealCards`/`startNewHand` when it's
this player's turn and the action is legal — simplified versions of `ui`'s
`useAutoPostBlinds`/`useAutoDeal`/`useAutoNewHand`, without the broader
auto-behavior system (fold/muck/show timeouts) that stays in 2b.

## Testing

- Unit tests for the ingest pipeline's event-derivation logic (pure functions
  — snapshot diffing, legal-action computation) following `desktop`'s
  existing `vitest` setup (Stage 1 introduced this).
- No automated tests for the WebSocket connection itself or the React
  components — matches `desktop`'s existing convention (`SendModal.tsx`/
  `WithdrawModal.tsx`/`DepositModal.tsx` have none either).
- Manual verification: `yarn lint`, `yarn start`, join a cash-game table with
  two clients (or against whatever test/staging backend is available),
  verify blinds post automatically, cards deal, betting actions work and
  submit real transactions, showdown resolves, next hand starts
  automatically.

## Stage 2b (not detailed here)

Full `GameMessageBus` choreography (decorators, backpressure, animation
pacing), `TurnAnimation`/`WinAnimation`, Sit & Go support (`claimWinnings`,
`SitAndGoWaitingModal`, `SngPayoutPanel`), the timeout-based auto-fallbacks
(`useAutoFold`/`useAutoMuck`/`useAutoShowCards`/`useAutoSitOutNextBB`). Gets
its own spec once 2a is verified working.
