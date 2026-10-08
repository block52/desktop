# Dark Sidebar Redesign — Design Spec

## Context

This session already built a light/dark theme system (CSS custom properties
in `src/index.css`) and re-skinned the Dashboard/Navbar/GameWallet/TableList/
wallet modals to a blue-gray accent with sharp (0px) corners, matching a
light-mode reference screenshot the user had shared earlier.

The user then shared a new, more complete reference: a bundled HTML export
(`Block52 Redesign.html`) containing a fully designed **Lobby** screen. This
supersedes the earlier direction entirely — it is dark-only, uses a purple
accent, 12px-radius chrome, and a left sidebar navigation instead of the
current top Navbar. The user confirmed (via three rounds of scoped
questions):

1. Apply this new design **app-wide** (Dashboard, Navbar→Sidebar, Table,
   modals) — not just the Dashboard.
2. Build the **sidebar** navigation shown in the mockup, replacing the top
   Navbar.
3. The sidebar wraps **every route, including the Table (in-game) page** —
   not just the Lobby.

Exact tokens and measurements below were pulled from the live-rendered
bundle via Playwright (`getComputedStyle`), not eyeballed from the
screenshot — same method used for the original Table UI token extraction
this session.

## Visual Reference

Rendered screenshot of the bundle (served locally, captured via Playwright):
a left sidebar (logo, PLAY group, NETWORK group, Admin/status footer) next
to a Lobby main panel (page header with search/balance/Deposit/avatar, a
promoted Sit & Go hero card, a "Your last session" / "Live now" stat pair,
and a Tables list below).

## Design Tokens (`src/index.css`)

Replace the existing light/`@media (prefers-color-scheme: dark)` pair with
a single dark palette. No manual toggle existed and no light variant exists
in the new reference, so light mode is dropped entirely.

```css
:root {
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
}
```

- `--danger` as measured is fairly dark/desaturated (it's a background
  tint in the source design system, not a text color). Where `--danger` is
  used as *text* (error messages, validation copy), implementers should
  check contrast against `--bg-app`/`--bg-card` and lighten locally if
  needed (e.g. `color-mix(in srgb, var(--danger) 70%, white)`) rather than
  changing the shared token — other consumers may rely on the darker value
  for borders/backgrounds.
- `--border-strong` is interpolated (no distinct "strong border" element
  existed in the bundle to sample) — follows the existing convention of a
  lighter/more-opaque variant of `--border`.
- Existing radius *exceptions* are unchanged and still apply on top of the
  new `--radius: 12px` default: `999px` for pill buttons/badges (confirmed
  against the mockup's own `Join`/`Register` buttons and `SIT & GO` badge,
  all measured at `border-radius: 999px`), `50%` for circular avatars, and
  `2px`/`4px` for mini playing-card shapes.
- Fonts: the mockup uses `Inter` (UI/body) and `JetBrains Mono` (addresses/
  numbers). Desktop currently loads `Barlow`/`Barlow Condensed` — check
  `index.html`/`index.css` for how those are loaded (system font stack vs.
  an actual font file) and swap the family names only; don't add a new
  font-loading dependency if the existing one is just a system-font
  fallback chain. If `Barlow`/`Barlow Condensed` are already bundled as
  real font files, keep using them rather than introducing `Inter` as a
  new asset — the mockup's typeface choice isn't a hard requirement, the
  token/color/layout system is.

## Component: Sidebar (replaces Navbar)

**New files:** `src/components/sidebar/Sidebar.tsx` + `.module.css`
**Removed from the render tree:** `src/components/navbar/Navbar.tsx`'s
usage in `src/router.tsx` (the component file itself can stay for now —
deleting it is a cleanup task at the end, once nothing imports it, but
`NetworkSelector` is reused, see below).

Mounted once in `src/router.tsx`, same position `<Navbar />` occupies
today, but **without** the `if (location.pathname.startsWith("/table/"))
return null;` early-return that `Navbar.tsx` currently has (confirmed at
`Navbar.tsx:114`) — the user confirmed the sidebar should wrap the Table
page too, unlike the old Navbar which hid itself there.

Structure (top to bottom):
- **Brand header**: logo mark + "Block52 / Poker VM" — port the existing
  `Logo` component's image-with-text-fallback pattern from
  `Navbar.tsx:8-27`.
- **PLAY group** (section label "PLAY"):
  - "Lobby" → `Link to="/"` (real route, active-state via
    `location.pathname === "/"`)
  - "Wallet" → `Link to="/wallet"` (real route)
  - "Hand history", "Players" — rendered but **disabled** (no `onClick`/no
    `Link`, reduced opacity ~0.4, `aria-disabled`, `cursor: not-allowed`).
    No pages exist for these yet; this is out of scope for a visual-reskin
    pass. Shown for visual fidelity to the mockup, not functional.
- **NETWORK group** (section label "NETWORK"):
  - The existing, already-working `NetworkSelector` (currently rendered in
    `Navbar.tsx:154`, ported this session from `ui`) is folded in here in
    place of a "Nodes" row — it's the one item in this group with real
    backing functionality (lists `NETWORK_PRESETS` + discovered networks,
    switches `currentNetwork`). Reuse the component as-is, just restyle
    its `.module.css` to the new tokens.
  - "Block explorer", "Hand distribution", "Tech notes" — rendered
    disabled, same treatment as Hand history/Players above. (The old
    Navbar already had a dead "Block Explorer" link with `href=""` and a
    no-op `onClick` at `Navbar.tsx:138-141` — this is not a regression,
    just carrying the same non-functional state into the new layout
    honestly, as a disabled item instead of a fake-clickable dead link.)
- **Footer**:
  - "Admin" — disabled, same treatment (no admin page exists).
  - Network/status chip: reuse the **existing, real** block-height-polling
    logic from `Navbar.tsx:83-112` (`getCosmosClient(...).getLatestBlocks(1)`
    on a 10s interval) to show "`<currentNetwork.name>` · Block
    `#<height>`" — this already works today (`Navbar.module.css`'s
    `.blockBadge`/`.blockDot`/`.blockNumber`), just move and restyle it.
  - Drop the `NFT` badge (`Navbar.tsx:165`, `.nftBadge`) — it's hardcoded
    dead UI with no real data behind it and doesn't appear in the new
    reference design.
  - Drop the manual refresh button (`Navbar.tsx:156-163`,
    `handleRefresh` = `window.location.reload()`) — blunt
    full-page-reload refresh doesn't fit a persistent sidebar nav and
    isn't in the reference design. (Per-section refresh, e.g.
    `TableList`'s own refresh button, is untouched.)

## Component: Table page layout

**Modify:** `src/pages/table/Table.tsx` / `Table.module.css` (and check
`TableHeader.tsx` for any width assumptions).

Since the sidebar now wraps the Table route too, the table page's outer
container needs a left margin/padding equal to the sidebar's width so it
doesn't render underneath it. This is the only structural change here —
`TableHeader`, `TableSidebar`, `PlayerSeating`, `Seat`, etc. keep their
current layout logic, just get the new tokens (`--radius: 12px` instead of
sharp corners, new color values — they already consume `var(--border)`
etc. so most of this is automatic) applied via the shared `index.css`
tokens change above.

## Component: Dashboard re-skin

**Modify:** `src/pages/dashboard/Dashboard.tsx` / `.module.css`.

Current structure (`Dashboard.tsx:67-88`) is a two-column layout: `<aside>`
with `GameWallet`, `<main>` with `TableList`. No header exists today.

Add a simple page header above the two-column layout:
- Title "Lobby" + a static subtitle (e.g. "Every shuffle verified
  on-chain. Pick a seat." from the mockup, or similar copy — not a hard
  requirement, placeholder copy is fine).
- A balance pill + "Deposit" button, sourced from the `balance`/
  `COSMOS_CONSTANTS.TOKEN_DENOM` lookup and `setShowDepositModal(true)`
  that already exist in `Dashboard.tsx` — this duplicates what
  `GameWallet` shows in the sidebar, which is intentional (matches the
  mockup's own layout, which has both a top-bar balance pill *and* a full
  wallet panel).
- An avatar: derive 1-2 character initials from `cosmosAddress` (e.g.
  `cosmosAddress.slice(2, 4).toUpperCase()`, skipping the `b52` prefix),
  rendered as a circular (`50%`) badge — no profile-picture system exists,
  this is the only data-backed approximation of the mockup's "7F" avatar.
- **No new search input** — `TableList` already has a working search box
  (`TableList.tsx:136-147`); adding a second one in the Dashboard header
  would be a dead/duplicate control. Restyle the existing `TableList`
  search to the new tokens instead; the page header's row simply doesn't
  include a search field. (Flagging this as a deliberate deviation from
  my earlier chat description, which mentioned a header search box — a
  duplicate non-wired search field isn't worth building.)

**Explicitly out of scope** (new functionality the mockup shows but that
has no backing data/logic in this codebase today — not part of a
visual-reskin pass):
- The promoted/featured Sit & Go hero card ("Friday Degens") — there's no
  concept of a "featured table" in `useFindGames` or anywhere else.
- "Your last session" stats (+$3.42, 38 hands, etc.) — no session-history
  data source exists.
- "Live now" aggregate stats (open tables / seated players / avg block
  time) — no aggregate-stats data source exists.
- Filter tabs ("All / Cash / Sit & Go" with counts) and "+ Create table"
  button on the Tables panel — `TableList` has search/sort/pagination
  today but no format-filtering or table-creation flow.

These are reasonable follow-ups but each needs its own data source or
flow; bundling them into this reskin would turn a bounded visual pass into
an open-ended features project. Flag to the user as candidates for a
future pass.

## Component: Wallet modals

**Modify:** `SendModal`, `WithdrawModal`, `DepositModal` (`.module.css`
only) — swap hardcoded/old-token values for the new `--radius: 12px` and
the new color tokens. No structural/behavioral changes; these already
consume the shared tokens from this session's earlier pass, so this is a
token-value change, not a rewrite.

## Testing

No new business logic is introduced (this is a token/markup/CSS pass plus
one structural move: Sidebar replacing Navbar in the render tree, and
reusing `NetworkSelector` + the block-height-polling effect verbatim).
Existing `vitest` suite (110 tests / 9 files) should remain green
unchanged. Manual verification: restart the Electron app, visually compare
Dashboard/Table/Wallet/modals against the rendered mockup screenshot for
color/radius/spacing fidelity, and confirm the sidebar's real links
(Lobby, Wallet, NetworkSelector) still function, disabled items don't
throw/navigate, and the block-height footer chip updates.

## Out of Scope (restated)

- Any new page (Hand history, Players, Block explorer, Hand distribution,
  Tech notes, Admin) — sidebar items for these are visual-only/disabled.
- Featured-table hero card, session stats, live-now stats, table
  filter tabs, "Create table" — see Dashboard section above.
- Font asset changes beyond a family-name swap, if the current font
  loading turns out to need a new dependency to match `Inter`/`JetBrains
  Mono` exactly (implementer's call, documented inline per the Fonts note
  above).
