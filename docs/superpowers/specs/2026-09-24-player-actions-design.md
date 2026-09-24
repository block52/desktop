# Desktop web port — Stage 2a Plan 2 (player actions) design

## Context

Stage 2a Plan 1 (WebSocket connection + game state) is merged to `main`:
`src/bus/{ingest,deriveEvents,GameMessageBus,types}.ts`, `src/context/
GameStateContext.tsx` (unified context exposing `gameState`/`isLoading`/`error`/
`validationError`/`pendingAction`/`latestEvents`/`subscribeToTable`/
`unsubscribeFromTable` — no action-submission methods, that's this plan), `src/
utils/cosmos/signing.ts`, `src/utils/guards.ts`. `Table.tsx` currently shows a
temporary raw-JSON debug dump of connection state.

Per the Stage 2a spec (`docs/superpowers/specs/2026-09-17-table-game-flow-design.md`),
in-scope player actions are:
- **Manual** (a button exists in `ui`): bet, call, raise, check, fold, join table,
  leave table, sit in, sit-in-and-wait, sit out, muck cards, show cards.
- **Auto-only, required** (no manual UI in `ui` at all — confirmed by reading its
  code during Stage 2a brainstorming; without these firing automatically a hand can
  never start or progress): post small blind, post big blind, deal cards, start new
  hand.
- Out of scope: `claimWinnings` (SNG/tournament-only), the `useAutoFold`/
  `useAutoMuck`/`useAutoShowCards` *timeout fallbacks* (safety nets on top of
  already-working manual actions), `useAutoSitOutNextBB`.

This spec covers the architecture and scope for delivering those actions, split
into three sequential implementation plans (each independently shippable, per the
same reasoning Stage 2a's connection work was split from its player-action and UI
work).

## Two things Plan 1 didn't anticipate, discovered reading `ui`'s action code

**1. Action-submission code needs synchronous access to the current snapshot.**
`ui`'s `transportAction.ts` (the function every action hook funnels through) keeps
a module-level `latestGameState` mirror, updated on every ingested WS message,
independent of React's render cycle — because `joinTable` (resolving a real empty
seat) and `useAutoNewHand` (deciding when to start the next hand) are plain
functions / hooks that need the *current* snapshot, not a stale closure over
`gameState` from whenever their own component last rendered.

Plan 1 dropped `ui`'s `setLatestGameState`/`getLatestGameState` side-channel
entirely, reasoning it only existed to let the "logical track" race ahead of a
paced "render track" — a distinction that doesn't apply here since Plan 1 has no
pacing at all. That reasoning was correct for what Plan 1 built, but incomplete:
the mirror serves a second, independent purpose Plan 1's scope didn't touch —
synchronous snapshot access for non-React action code.

**Resolution:** `GameMessageBus` (Plan 1, already merged) already computes exactly
this internally as `getLastSnapshot()` — it's just not exposed through the context.
Plan 2a adds `getLatestSnapshot(): TexasHoldemStateDTO | undefined` to
`useGameState()`'s return value, backed by the existing bus method. No new
module-level mutable state, no duplicate mirror — callers that need the current
snapshot from a plain function call `useGameState().getLatestSnapshot()` from
within a hook (all the callers that need this — `joinTable`, `useAutoNewHand` —
are hooks or can be called from one), rather than reaching into a bare global.

**2. Two findings parked at the end of Plan 1 become load-bearing here.** Plan 1's
final review found (and the controller deliberately deferred, since nothing in
Plan 1's single-table scope exercised them): stale WS messages from a
just-replaced socket can still update state for the wrong table and corrupt the
bus's shared `lastSnapshot` baseline; and the `CONNECTING` guard in
`subscribeToTable` blocks subscribing to *any* table (not just the same one)
while a previous handshake is in flight. Plan 2's action hooks read
`getLatestSnapshot()` for real decisions (which seat to join, whether to start a
new hand) — a corrupted baseline now has a concrete, reachable consequence it
didn't have when nothing consumed the snapshot outside `Table.tsx`'s debug
render. Closing these first, rather than building actions on top of an
unhardened connection, is Plan 2a's job.

## Scope — three plan documents

### Plan 2a: Connection-lifecycle hardening

- Add a generation counter (or equivalent) to `GameStateContext`'s WebSocket
  lifecycle: each `subscribeToTable` call mints a new generation; `ws.onopen`/
  `ws.onmessage`/the fallback timeout all check their captured generation is
  still current before calling any state setter or touching `busRef`. Closes:
  the stale-message-after-resubscribe leak, and the CONNECTING guard blocking a
  switch to a *different* table (a new subscribe to a different table should
  supersede an in-flight one, not be silently dropped).
- Add `getLatestSnapshot()` to `GameStateValue`/`useGameState()`.
- No behavior change to anything Plan 1 already proved working (single-table
  connect/disconnect) — this is additive hardening plus one new accessor.

### Plan 2b: Action transport + legal-action computation

- `desktop`-local result types (`PlayerActionResult`, `JoinTableResult`,
  `LeaveTableResult`) — confirmed not SDK exports, `ui`-local types to be
  re-declared, not duplicated-and-diverged (mirror `ui`'s shapes exactly).
- Port `executeTransportAction(tableId, action, amount, network, data?):
  Promise<PlayerActionResult>` — the shared path every in-hand action hook
  calls: `getSigningClient(network)` (already in `desktop`'s
  `utils/cosmos/client.ts`, reused as-is) → `signingClient.performActionSync(...)`,
  with a single retry on a Cosmos sequence-mismatch (code 32) and a rewritten
  stale-action-index error message. `join`/`leave` do NOT go through this path —
  they call `signingClient.joinGame`/`leaveGame` directly through a separate
  retry wrapper (`ui`'s `withMoneyMoverRetry`), a distinction to preserve, not
  flatten into one path.
- Port `usePlayerLegalActions` — computes which actions are legal from
  `gameState.players`/`nextToAct`/`legalActions`. Adapted to read from
  `useGameState()` instead of `ui`'s `useGameData()`/`useGameUI()` split, and to
  use `getCosmosAddress()` (existing `desktop` function) instead of `ui`'s
  inconsistent direct-`localStorage` read (an inconsistency in `ui` itself,
  normalized during the port rather than copied).

### Plan 2c: The action hooks

- Manual action hooks: `betHand`, `callHand`, `raiseHand`, `checkHand`,
  `foldHand`, `joinTable` (seat resolution + `parseUsdcToMicro` buy-in
  conversion, using `getLatestSnapshot()` from Plan 2a), `leaveTable`, `sitIn`
  (post-now method only — `SIT_IN_METHOD_NEXT_BB` is blocked upstream in `ui`
  itself per its own code comment, not a live path worth porting), `sitInAndWait`,
  `sitOut` (using the SDK's now-exported `SitOutMethod`/`SIT_OUT_METHOD_NEXT_HAND`/
  `SIT_OUT_METHOD_NEXT_BB` — `ui`'s local `SitInMethod` declaration with a
  "TODO: import from SDK" comment is stale; the SDK exports `SitInMethod`/
  `SIT_IN_METHOD_POST_NOW`/`SIT_IN_METHOD_NEXT_BB` directly now, use that
  instead of re-declaring it), `muckCards`, `showCards`.
- Auto-only action hooks: `useAutoPostBlinds`, `useAutoDeal` (calls
  `dealCardsWithEntropy(tableId, network, "")` — empty entropy, matching `ui`'s
  current behavior), `useAutoNewHand`. All three watch caller-supplied
  legal-action flags (from Plan 2b's `usePlayerLegalActions`) plus a
  ref-guarded "already triggered this opportunity" pattern; `useAutoNewHand`
  additionally reads `getLatestSnapshot()` directly and re-checks on every
  `latestEvents` change from `useGameState()` (replacing `ui`'s
  `GameEventsContext().latestItem` as the "something changed" tick — Plan 1's
  `latestEvents` already serves this role, only updated on real `state` frames
  per Plan 1's own fix-wave correction).
- Wire one temporary button per action into `Table.tsx`'s existing debug page —
  same proof-of-concept pattern Plan 1 used for the connection itself. Fully
  replaced when Plan 3 (real table UI) lands; nothing later depends on this
  file's markup.

## Explicitly out of scope (unchanged from the Stage 2a spec)

`claimWinnings`, `useAutoFold`/`useAutoMuck`/`useAutoShowCards` (timeout
fallbacks only — the manual fold/muck/show actions they sit on top of are in
scope), `useAutoSitOutNextBB`, Sit & Go support generally, hand history/replay,
the full `GameMessageBus` choreography (decorators/backpressure/pacing — still
Stage 2b), the real table UI (Plan 3).

## Testing

- Unit tests for `usePlayerLegalActions`' pure computation logic and
  `executeTransportAction`'s retry logic (Plan 2b) — the strongest TDD
  candidates in this plan, following `desktop`'s existing `vitest` setup.
- No automated tests for the individual thin action-hook wrappers (matches
  Stage 1's precedent for thin `wagmi`-style wrapper hooks) or the auto-trigger
  hooks (ref-guarded effect timing, not meaningfully unit-testable in isolation).
- Manual verification via `Table.tsx`'s debug-page buttons: join a table, watch
  blinds/deal fire automatically, exercise each manual action, confirm a
  showdown resolves and the next hand starts automatically.
