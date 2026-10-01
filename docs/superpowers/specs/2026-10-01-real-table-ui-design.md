# Desktop web port — real table UI design

## Context

Stage 2a's three player-action plans are all merged to `main` (Plans 2a/2b/2c
under `docs/superpowers/specs/2026-09-24-player-actions-design.md`): the
WebSocket connection/game-state layer, the action-transport layer, and all 15
player-action hooks (12 manual, 3 auto-only) — a complete, working hook API
for playing a hand. `src/pages/table/Table.tsx` still shows the Plan-1-era
temporary debug page (raw JSON dumps, plain HTML buttons) that Plan 2c
explicitly built as a throwaway proof-of-concept, not a real UI.

The original Stage 2a spec
(`docs/superpowers/specs/2026-09-17-table-game-flow-design.md`) already
scoped a "real component breakdown matching `ui`'s boundaries" as in-scope —
`Table.tsx` root, `PlayerSeating`, `TableBoard`, `PlayerActionButtons`,
`TableHeader`, `TableSidebar`, pot display, status messages,
`Player`/`OppositePlayer`/`VacantPlayer`, card components, `NoWalletOverlay`,
`TableErrorPage` — but assumed a faithful visual port of `ui`'s *existing*
CSS/styling. Separately, earlier in this session's work, the user shared a
Claude Design canvas mockup (Lobby/wallet screen only) and explicitly
deferred using it for a "UI rewrite" as unplanned future work.

This session, asked to choose between porting `ui`'s current visual design
or using the Claude Design mockup for this piece of work, the user chose
**the Claude Design mockup** — explicitly un-deferring it, scoped to the
table screen specifically. The mockup itself only contains the Lobby
screen (confirmed by loading it directly — the "Join" buttons are dead
links with no destination), so the table screen's visual design was
designed fresh this session, extrapolating the Lobby's real, measured
design tokens, and iterated via the `superpowers:brainstorming` visual
companion tool until the user approved the layout.

## Visual design system

Extracted by measuring the live Lobby mockup's computed styles directly
(not guessed):

| Token | Light | Dark | Notes |
|---|---|---|---|
| Body text | `#1d1f20` | `#eceded` | near-black / near-white |
| Muted text | `rgba(29,31,32,0.6)` | `rgba(236,237,237,0.6)` | labels, secondary info |
| Border (hairline) | `rgba(29,31,32,0.16)` | `rgba(236,237,237,0.14)` | panel/card borders |
| Border (strong) | `rgba(29,31,32,0.32)` | `rgba(236,237,237,0.28)` | emphasis borders |
| Accent (steel blue) | `#5980a6` | `#7fa6cc` | primary buttons, active states, "Connected" badge |
| Accent text | `#f2f2f3` | `#14181a` | text on accent-filled surfaces |
| Danger | `#b3503f` | `#d97c6c` | fold button, errors |
| App background | `#f2f2f3` | `#17191b` | |
| Card/panel background | `#ffffff` | `#1f2224` | |

- **Fonts:** `Barlow` for body text; `"Barlow Condensed"` for headings,
  numeric values (stacks, pot, blinds), and buttons — this pairing is the
  Lobby mockup's actual font stack, not a guess.
- **Border radius: zero** everywhere in the app chrome (nav, panels,
  buttons, inputs, table header) — confirmed `0px` on every measured
  element. This is a deliberate "technical/blueprint" aesthetic, not an
  oversight.
- **Dark mode:** the mockup itself is light-only; the dark palette above
  is this session's extrapolation, approved by the user via the visual
  companion (toggle-tested on every mockup screen).
- **The table felt is the one deliberate exception to zero-border-radius** —
  poker tables are conventionally curved, and player avatars are circular.
  Both use large/50% border-radius values, intentionally inconsistent with
  the rest of the app chrome.

## Table shape and seat geometry — ported from `ui`, not guessed

Investigated `ui`'s actual `src/components/playPage/Table.tsx` and
`src/config/stageGeometry.ts` directly (not assumed) before designing this:

- **Shape:** `ui`'s felt is a CSS "stadium" (flat sides, semicircular rounded
  ends) — a wide rectangle with `border-radius` set to (or beyond) half its
  own height, which the browser clamps to produce flat long edges and
  semicircular short edges. It is **not** a smooth ellipse, and there is no
  felt image asset anywhere in `ui` — the oval is pure CSS. This design
  reproduces the same technique responsively: `border-radius: 9999px` on a
  box with a fixed aspect, which the browser clamps identically to a
  hand-computed pixel value.
- **Seat layout is real, hand-tuned data, not evenly-spaced-by-angle.**
  `ui`'s `SEAT_COORDS: Record<TableSize, [number, number][]>` (`TableSize =
  2 | 4 | 6 | 9`) gives absolute stage-pixel coordinates per seat, per table
  size — e.g. the 9-seat layout clusters 3 seats along the bottom rail
  (hero dead-center), 2 at the very top, and 2 pairs on the sides, not a
  symmetric nonagon. **Port `SEAT_COORDS` for all four sizes (2/4/6/9)
  verbatim**, converting each table size's coordinate set to percentages
  relative to its own bounding box (as this session's mockup did for the
  9-seat case) rather than `ui`'s absolute-px-plus-viewport-zoom approach —
  CSS percentage positioning is simpler and sufficient for a desktop
  window that isn't being scaled to arbitrary mobile viewports (`ui`'s
  `calculateZoom()`/mobile-rotation handling is explicitly out of scope,
  see below).
- **"Hero always at bottom" rotation:** `ui` computes `seatNumber =
  ((uiPosition + startIndex) % tableSize) + 1`, recomputing `startIndex`
  whenever the local player's seat changes, so the local player's seat
  always renders at the bottom-center position regardless of their actual
  server-assigned seat number. **Port this rotation formula** — it's
  real, load-bearing UX logic, not a styling choice.
- **Max table size for this plan's fixtures/testing: 9** (matches the
  spec's existing cash-game/Sit-and-Go scope, and `maxPlayers` from
  `gameState.gameOptions` already drives which `SEAT_COORDS` set to use,
  mirroring `ui`'s own `useTableState`-driven approach).
- **Dealer button:** `ui` uses an SVG image positioned by linear
  interpolation along each seat→center vector. This design does not need
  a dealer-button image — the existing seat badge treatment (see below)
  already marks the dealer position with a "D" badge, which is simpler and
  consistent with how SB/BB/Turn are already shown. Not reusing `ui`'s
  `CustomDealer.svg`/`getDealerPositions()` — no image asset needed.

## Component design (per seat)

Decided through 5 rounds of visual iteration (see "Iteration history"
below for the concrete bugs found and fixed):

- **Avatar:** a 44px circular badge, background color varies per seat
  (from a small fixed palette — not tied to player identity/address in any
  deterministic way yet, revisit if needed), containing a generic
  person-silhouette icon (plain inline SVG) — **not** text initials. Text
  initials were tried first and rejected: they duplicate the name already
  shown in the nameplate directly below, and read as an unfinished
  placeholder rather than a deliberate choice.
- **Status badge:** a small pill ("Turn" / "SB" / "BB" / "D") floating
  above the avatar via absolute positioning (does not affect the seat's
  layout height) when applicable.
- **Nameplate:** an oval pill directly below the avatar (slight negative
  margin so it tucks against the avatar), showing the player's
  name/truncated address and current stack.
- **Hole cards:** two small face-down card rectangles below the nameplate
  (always shown for an occupied, active-hand seat — this design doesn't
  yet address showdown/reveal states, see "Out of scope").
- **Bet chip:** a small pill below the cards, shown only when the player
  has a non-zero current-round bet. **This conditional element is the
  root cause of a real alignment bug found and fixed during iteration —
  see below.**
- **Vacant seat:** a dashed-outline circle with a "+" glyph instead of an
  avatar, and a dashed "Empty" nameplate — visually distinct from an
  occupied seat at a glance, same geometry slot.

### Critical implementation detail: anchor seats on the avatar, not the seat box

Each seat's total height varies — a seat with a bet chip or a status badge's
sibling elements is taller than one without. (The badge itself doesn't
affect height, since it's absolutely positioned and out of flow — but the
bet chip is a normal-flow element and does.) **Do not center-position the
seat element on its own bounding box** (i.e. do not use
`transform: translate(-50%, -50%)` referencing the seat's own, variable,
total height) — this was tried and produces a real bug: seats with a bet
chip shift up further than seats without one, so same-row seats drift out
of vertical alignment with each other purely based on whether they
currently have a bet showing. **Anchor on the avatar's own fixed half-height
instead** (`transform: translate(-50%, -22px)` for a 44px avatar, since the
avatar is always the first element in a top-aligned flex column regardless
of what renders below it). This keeps every seat's avatar pinned to its
intended coordinate regardless of which optional elements (bet chip, badge)
happen to be present on a given render. Implement this as the seat
component's fundamental positioning contract, not a one-off CSS tweak — any
future addition to the seat's conditional content (e.g. a "sitting out"
indicator) must go below the avatar in flow, never change the avatar's own
position in the stack, and must not require revisiting this anchor math.

## Layout bugs found during iteration (fix these from the start — don't reintroduce them)

1. **Header/seat vertical overlap.** A naive seat-plane coordinate range of
   0%–100% (mapping directly from `ui`'s `SEAT_COORDS` bounding box) puts
   the top-row seats' badges flush against — and overlapping — the table
   header bar above it. Fix: compress the seat plane's own usable vertical
   range to roughly 14%–90% (not 0%–100%) before mapping `SEAT_COORDS`
   percentages onto it, leaving real clearance above and below for the
   header and action bar.
2. **Left/right seat horizontal bleed past the window edge.** The felt
   container's horizontal padding must be **at least half a seat's own
   rendered width** (39px for a 78px-wide seat), because the leftmost/
   rightmost seats sit at the seat-plane's literal 0%/100% x-coordinate
   and are horizontally centered on that point via `translateX(-50%)` —
   meaning half the seat box extends past the coordinate itself. Too little
   padding here is invisible in a screenshot with generous surrounding
   canvas but genuinely clips/goes off-screen on a real, tighter browser
   window. Use `overflow: hidden` on the outermost window/page container
   as a hard backstop regardless.
3. **Bottom-row seat misalignment inherited from `ui`'s own coordinate
   data.** `ui`'s real `SEAT_COORDS[9]` places the hero seat 10px lower
   than its two bottom-row neighbors (a subtle intentional offset in
   `ui`'s own larger, more complex rendering context). At this design's
   smaller scale, that offset reads as a visual bug, not an intentional
   design choice. Fix: align all three bottom-row seats (and, by the same
   reasoning, both members of every other symmetric pair) to the identical
   vertical coordinate — do not carry over `ui`'s per-seat micro-offsets
   verbatim.
4. **Avatar vertical misalignment from variable seat-box height** — see
   "Critical implementation detail" above. This is the most important bug
   of the four: it's state-dependent (only visible once some seats have a
   bet showing and others don't, i.e. mid-hand, not in a static initial
   render), so it's easy to miss in a quick visual check and must be
   verified by testing with a realistic mixed-bet-state fixture, not just
   an all-folded or all-equal-bet table.

## States to implement

1. **Active hand** (the primary state): felt + seats + pot/community cards
   in the center, legal-actions + hand-history side panels, bottom action
   bar (bet/raise amount inputs, fold/check/call/raise/bet buttons,
   sit-in/sit-in-and-wait/sit-out, muck/show — wired to the real hooks
   from Plan 2c), auto-behavior status line.
2. **Waiting for players** (cash table, hand not yet started): same shell,
   vacant-seat treatment for all unfilled seats, center message replaces
   pot/cards with a "Waiting for players — N / maxPlayers seated" message,
   no in-hand action buttons (nothing is legal yet).
3. **Sit & Go waiting to fill:** same as #2, but the center message shows
   the prize pool and fill count instead of a pot — **this matches `ui`'s
   actual, confirmed behavior** (`isSitAndGoWaitingForPlayers` hides the
   pot display specifically for this case; it is not a new design
   decision, it's a port of existing behavior). Include a
   "Leave / Unregister" action instead of in-hand buttons.
4. **No wallet connected:** a dimmed/blurred table rendered behind a
   centered overlay card with a "Connect Wallet" CTA — the table itself
   stays visible (read-only context) rather than being replaced entirely,
   since there may be a real table to look at even before a wallet is
   connected.
5. **Connection error:** unlike the no-wallet state, this **replaces** the
   table area entirely rather than overlaying it — there is no game state
   to show underneath a failed connection. Centered icon + message +
   Retry button, matching `GameStateContext`'s existing `error` surface
   (Plan 2a, already merged).

## Data flow — wiring real hooks into these components

Everything visual in this spec sits on top of infrastructure that's
already built and merged:

- `useGameState()` (Plan 2a/1) — `gameState`, `isLoading`, `error`,
  `validationError`, `latestEvents`, `getLatestSnapshot`,
  `subscribeToTable`/`unsubscribeFromTable`.
- `usePlayerLegalActions()` (Plan 2b) — drives which action buttons are
  enabled/disabled and feeds the three auto-hooks' gating booleans.
- The 12 manual action hooks + 3 auto-only hooks (Plan 2c) — every button
  in the action bar calls directly through to these; no new transport or
  submission logic is needed, only the visual wiring.
- `NetworkContext`'s `useNetwork()` — unchanged, already used throughout.

This spec is purely the presentation layer: real component boundaries,
real visual design, real seat-geometry math (ported from `ui`), wired to
an already-complete data/action layer. No new hooks, no new transport
logic, no changes to `GameStateContext.tsx`/`GameMessageBus.ts`/any
already-merged file from Plans 2a/2b/2c.

## Component breakdown (maps to `ui`'s real boundaries, restyled)

- `Table.tsx` — root; owns `subscribeToTable`/`unsubscribeFromTable`
  lifecycle (already exists, unchanged), composes the pieces below based
  on connection/wallet/game state.
- `TableHeader` — club/table name, blinds, hand number, round, player
  count, Leave Table button.
- `TableBoard` — felt, rail, pot, community cards, round label. Branches
  internally for the Sit & Go waiting-to-fill pot-hiding behavior.
- `PlayerSeating` — owns the seat-coordinate math (ported `SEAT_COORDS` +
  hero-rotation) and renders one `Seat` per position.
- `Seat` (replaces `ui`'s `Player`/`OppositePlayer`/`VacantPlayer` split
  with a single component branching on occupied/vacant/active — the
  three-component split in `ui` exists for its own historical/animation
  reasons that don't apply to this simpler, non-choreographed render path;
  revisit only if real complexity demands it, per YAGNI) — avatar, badge,
  nameplate, cards, bet chip.
- `PlayerActionButtons` — the action bar; wires every button to its real
  hook from Plan 2c.
- `TableSidebar` — legal-actions + hand-history panels.
- `NoWalletOverlay` — the overlay card described above.
- `TableErrorPage` — the full-replace error state described above.

## Explicitly out of scope

- Showdown/card-reveal visuals (flipping hole cards face-up, win-highlight
  animation) — this spec covers the static seat/card treatment only; any
  reveal *animation* is Stage 2b's choreography layer, already deferred.
- `TurnAnimation`/`WinAnimation` and all `GameMessageBus` decorator/pacing
  work — unchanged, still Stage 2b.
- Mobile/responsive layout, `ui`'s `calculateZoom()`/viewport-fit/
  90°-rotation handling — this is a desktop Electron app at a fixed
  window-class size; revisit only if window resizing becomes a real
  requirement.
- Table theme switching (`ui`'s modern/classic/nouns themes) — one design
  system only, per this spec.
- Sit & Go payout/claim UI (`SngPayoutPanel`, `claimWinnings`) — still out
  of scope per the original Stage 2a spec, unchanged.
- Hand history detail/replay — the sidebar's "Hand history" panel in this
  design is a simple list (hand #, result, amount), not a replay viewer.
- Dealer-button image/animation — using the existing badge treatment
  instead, see "Table shape and seat geometry" above.

## Testing

- No automated tests for the visual components themselves (React
  components with no meaningful pure-logic surface) — matches this
  codebase's established convention (no page/component tests exist
  anywhere in `desktop`).
- **The ported seat-coordinate/rotation logic (`SEAT_COORDS` lookup +
  percentage conversion + hero-rotation formula) should be extracted into
  a pure, testable module** (mirroring how `resolveJoinSeat` was pulled
  out and tested in Plan 2c) — this is real, non-trivial logic
  (`((uiPosition + startIndex) % tableSize) + 1`) worth covering directly,
  not just eyeballing in the browser.
- Manual verification: `yarn start`, exercise each of the 5 states
  described above (a live table for the active-hand/waiting states, a
  disconnected/no-wallet session for the other two), confirm no layout
  regressions against the 4 bugs documented above — specifically, verify
  the avatar-alignment fix (#4) against a real hand where only *some*
  players have a current bet showing, not just an all-equal or all-zero
  fixture.
