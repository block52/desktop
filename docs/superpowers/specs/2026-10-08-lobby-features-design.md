# Lobby Features (Featured Table, Live Stats, Filters, Create Table) — Design Spec

## Context

The dark-sidebar-redesign plan (`docs/superpowers/specs/2026-10-08-dark-sidebar-redesign-design.md`)
deliberately scoped out 5 pieces of the reference mockup
(`~/Downloads/Block52 Redesign.html`) that needed new data or
logic beyond a pure visual re-skin: a promoted/featured Sit & Go hero
card, "Your last session" stats, "Live now" stats, format filter tabs,
and a "Create table" flow. The user asked to build the remaining four
(session stats were confirmed dropped — no backing data exists anywhere
for hand history or session P&L, and inventing numbers would be
misleading).

Research this session confirmed exactly what's buildable from the
already-installed `@block52/poker-vm-sdk` with zero new backend work,
and pinned down the exact shapes needed for the Create Table form. All
citations below are from `node_modules/@block52/poker-vm-sdk/dist/`.

## Data Architecture

`src/pages/dashboard/Dashboard.tsx` gains its own `useFindGames()` call
(it already calls `useCosmosWallet()`/`useNetwork()` directly — this
matches existing style). The resulting `games: GameWithFormat[]` feeds
two new presentational components, `FeaturedTable` and `LiveStats`, via
props.

`src/components/tableList/TableList.tsx` keeps its own independent
`useFindGames()` call completely unchanged — it's an already-reviewed,
self-contained component with its own search/sort/pagination state
tightly coupled to its own fetch. Duplicating one lightweight read query
is a reasonable trade for not touching its internals or prop interface.

A new hook, `src/hooks/useAvgBlockTime.ts`, polls `getLatestBlocks(5)`
(reusing the `getCosmosClient({ rpc, rest })` pattern already used in
`src/components/sidebar/Sidebar.tsx:65-100`) every 15 seconds, and
computes the average delta (in seconds) between consecutive blocks'
`block.header.time` timestamps across the 5 returned blocks. Returns
`{ avgBlockTimeSeconds: number | null, isLoading: boolean }` —
`null` until the first successful fetch or on persistent error (same
silent-failure-to-null pattern `Sidebar.tsx`'s block-height poller
already uses, rather than surfacing a dedicated error state for a
decorative stat).

## Layout

Dashboard's existing two-column structure (`<aside>` GameWallet |
`<main>` TableList) is unchanged. Inside `<main>`, a new row renders
above `<TableList />`:

```
<div className={styles.overviewRow}>
    <FeaturedTable game={featuredGame} />
    <LiveStats openTables={games.length} seatedPlayers={...} avgBlockTimeSeconds={...} />
</div>
```

If no Sit & Go exists (`featuredGame` is `null`), `FeaturedTable`
renders nothing and `LiveStats` alone fills the row (`flex: 1` on
`LiveStats`, conditionally rendered `FeaturedTable`).

## Component: FeaturedTable

**New files:** `src/components/featuredTable/FeaturedTable.tsx` + `.module.css`

**Selection heuristic** (computed in `Dashboard.tsx`, passed down as a
single `game: GameWithFormat | null` prop — selection logic doesn't
belong inside a presentational component):

```ts
function selectFeaturedGame(games: GameWithFormat[]): GameWithFormat | null {
    const sngGames = games.filter(g => g.gameFormat === GameFormat.SIT_AND_GO);
    if (sngGames.length === 0) return null;
    const withStartTime = sngGames.filter(g => g.sngStartTime != null);
    if (withStartTime.length > 0) {
        return withStartTime.sort((a, b) => a.sngStartTime! - b.sngStartTime!)[0];
    }
    // Fallback: fullest Sit & Go waiting to start
    return [...sngGames].sort((a, b) => b.currentPlayers - a.currentPlayers)[0];
}
```

(`sngStartTime` must be confirmed present on `GameWithFormat`/the
underlying `GameOptionsDTO` during planning — `convertUtils.ts` may need
a small addition to pass it through if it's on the SDK type but not yet
surfaced in the app's own `GameWithFormat` shape.)

**Rendering:** name/ID, "SIT & GO" badge (reusing `TableList.module.css`'s
existing `.badgeSng` pill styling, or a local equivalent), player count
(`currentPlayers/maxPlayers`), buy-in range, and a "Register"/"Join"
button that calls the exact same `navigate(`/table/${game.gameId}`)`
`TableList.tsx:258` already uses — no new navigation logic.

## Component: LiveStats

**New files:** `src/components/liveStats/LiveStats.tsx` + `.module.css`

Three stat cells, each a label + number, matching the mockup's compact
stat-card look (reuse the `--bg-card`/`--border`/`--radius` token
pattern already established): "Open Tables" (`openTables` prop, direct
int), "Seated" (`seatedPlayers` prop, `sum(games.map(g =>
g.currentPlayers))`, computed in `Dashboard.tsx`), "Avg Block"
(`avgBlockTimeSeconds` prop, formatted as `"{n.toFixed(1)}s"` or
`"—"` while `null`/loading).

## Component: TableList filter tabs

**Modify:** `src/components/tableList/TableList.tsx` + `.module.css`

New local state `const [formatFilter, setFormatFilter] = useState<"all" |
"cash" | "sit-and-go">("all")`. Three pill tabs ("All", "Cash", "Sit &
Go") rendered in the existing header row, each showing a live count
(`games.length`, `games.filter(isCash).length`,
`games.filter(isSitAndGo).length` — reuse the existing `isTournamentFormat`
import's sibling helpers or a local equivalent check against
`GameFormat.CASH`/`GameFormat.SIT_AND_GO`). The selected tab filters
`games` before the existing search-text filter applies in the `games`
`useMemo` (`TableList.tsx:66-88`) — one more `.filter()` call added to
that existing memo, not a new data flow.

Tournament format gets no dedicated tab (the mockup doesn't show one
either) — a Tournament-format row, if one existed, would appear under
"All" only. This is a deliberate scope line, not an oversight.

A "+ Create table" button renders next to the tabs, opening the new
`CreateTableModal` (below).

## Component: CreateTableModal + useCreateGame hook

**New files:**
- `src/hooks/useCreateGame.ts`
- `src/components/modal/CreateTableModal.tsx` + `.module.css`

**Hook contract**, following the existing manual-action-hook shape
already used for join/leave/bet elsewhere in `src/pages/table/Table.tsx`
(`runAction`-style: set submitting, call the SDK, return a typed result,
clear submitting):

```ts
interface CreateGameParams {
    gameFormat: GameFormat.CASH | GameFormat.SIT_AND_GO;
    gameVariant: GameVariant;           // TEXAS_HOLDEM | OMAHA
    minPlayers: number;
    maxPlayers: number;
    minBuyIn: bigint;                   // micro-USDC
    maxBuyIn: bigint;                   // micro-USDC
    smallBlind: bigint;                 // micro-USDC
    bigBlind: bigint;                   // micro-USDC
    timeout: number;                    // seconds
    rakeConfig?: {
        rakeFreeThreshold: bigint;
        rakePercentage: number;         // whole-number percent, e.g. 5 = 5%
        rakeCap: bigint;
        owner: string;
    };
    sngConfig?: {                       // required when gameFormat is SIT_AND_GO
        startingStack: bigint;
        blindLevelDuration: number;     // seconds, must be > 0
        entryFee?: bigint;
    };
    name?: string;                      // paid custom name
}

function useCreateGame(): {
    createGame: (params: CreateGameParams) => Promise<string>; // returns gameId
    isSubmitting: boolean;
}
```

Internally calls `SigningCosmosClient.createGame(gameFormat, gameVariant,
minPlayers, maxPlayers, minBuyIn, maxBuyIn, smallBlind, bigBlind, timeout,
rakeConfig, sngConfig, name)` — confirmed signature at
`node_modules/@block52/poker-vm-sdk/dist/signingClient.d.ts:78`. The
client itself throws if `gameFormat` is SIT_AND_GO/TOURNAMENT and
`sngConfig` is missing or has a non-positive `startingStack`/
`blindLevelDuration` (`index.esm.js:61258-61280`) — the form's own
client-side validation (below) should catch this before submission so
the error never reaches the SDK, but the SDK's own check is a real
backstop, not dead code to replicate exactly.

**Form fields** (full set, per the user's explicit choice):

| Field | Type | Notes |
|---|---|---|
| Format | Cash / Sit & Go toggle | **Not** Tournament — `TOURNAMENT`'s config shape beyond `sngConfig` wasn't confirmed by research; adding it now risks a wrong form. Noted as a future addition. |
| Variant | Select, defaults to Texas Hold'em | SDK's `GameVariant` enum has exactly two real values: `TEXAS_HOLDEM = "texas-holdem"`, `OMAHA = "omaha"` (confirmed, `index.d.ts:45301-45308`). Expose both as options — Omaha is a real SDK value, not a hypothetical, even though no part of this app currently exercises it beyond a type-roundtrip unit test. |
| Max Players | Select: 2 / 4 / 6 / 9 only | **Not** a free-number input. The app's seat-rendering (`src/config/seatGeometry.ts:19-32`) only has real layouts for 2/4/6/9-max tables — anything else renders crammed into the 9-max layout. Constraining the form to these 4 values avoids creating tables the UI can't render properly. Min Players defaults to the same value as Max Players unless the format needs a distinct minimum (Sit & Go: min = max, since it starts when full; Cash: min can be 2 regardless of max). |
| Buy-in range | Two USDC amount inputs (min/max) | Converted to micro-USDC via the existing `parseUsdcToMicro` pattern already used in `Table.tsx`. |
| Blinds | Two USDC amount inputs (small/big) | Same conversion. |
| Timeout | Number input, seconds | No SDK-enforced min/max found (confirmed — `createGame`'s implementation passes `timeout` straight through with no range check; any enforcement is on-chain, outside this repo). Default to a reasonable value (e.g. 30s) and apply only an app-side sanity floor (e.g. ≥5s) to prevent an unusably fast timer — this is a new, local UX guard, not an SDK requirement. |
| Rake | Checkbox to enable + 3 fields when enabled: free-play threshold (USDC), percentage (whole number, e.g. "5" = 5%), cap (USDC) | Omitting `rakeConfig` entirely defaults to zero rake at the SDK level (`index.esm.js:61297-61302`) — so "no rake" is simply not checking the box, not a special-cased empty config. `owner` defaults to the creator's own Cosmos address (the one submitting the transaction) when rake is enabled — no SDK guidance exists on this, but it's the only sensible default for a self-serve creation form; not exposed as an editable field in this first version. |
| Sit & Go config | Shown only when Format = Sit & Go: starting stack (USDC), blind level duration (minutes, converted to seconds), optional entry fee (USDC) | `startingStack` and `blindLevelDuration` are both required by the SDK when format is Sit & Go (validated client-side in the SDK itself, see above) — the form must require them too, before submission. |
| Table name | Optional text input, live fee preview | Uses `computeGameNameFee(name)` (`$0.10 per character, max 32 chars` — `GAME_NAME_MICRO_PER_CHAR = 100000n`, `MAX_GAME_NAME_LENGTH = 32`, confirmed `index.d.ts:45573-45586`) to show "Cost: $X.XX" live as the user types, capped at 32 characters by the input itself. |

**Submission flow:** matches `DepositModal`'s existing step pattern
(form → submitting spinner → success state showing the new `gameId` with
a "Join now" button that navigates to `/table/${gameId}`, or an error
banner on failure) rather than inventing a new interaction shape.

## Testing

`useAvgBlockTime` and `selectFeaturedGame` (the heuristic function) are
the two genuinely new pieces of pure logic in this spec — both get unit
tests (block-time averaging across a fixture `BlockResponse[]` array;
featured-game selection across fixtures with/without `sngStartTime`,
with zero Sit & Go games, and with multiple candidates). `useCreateGame`
is a thin SDK wrapper (call-through plus submitting-state bookkeeping) —
manual verification against the running app is sufficient, consistent
with how this session's other chain-transaction hooks were verified
rather than unit-tested. `FeaturedTable`/`LiveStats`/`CreateTableModal`
are presentational/form components with no existing precedent for unit
tests elsewhere in this codebase (same reasoning as every other
component this session) — manual verification only.

## Out of Scope

- "Your last session" stats — confirmed dropped, no data source exists.
- Tournament format in Create Table — config shape beyond `sngConfig`
  unconfirmed; future addition.
- Editable rake `owner` field — defaults to the creator, not exposed.
- Any new backend/chain work — everything here uses SDK capabilities
  that already exist.
