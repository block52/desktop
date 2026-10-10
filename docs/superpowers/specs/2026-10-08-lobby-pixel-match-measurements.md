# Lobby Pixel-Match Measurements (mockup = source of truth)

Source: `~/Downloads/Block52 Redesign.html` (Claude Design bundle, one screen: `data-screen-label="Lobby"`), measured live at a **1440×900** viewport via `getComputedStyle` / `getBoundingClientRect`, plus the bundle's own stylesheet source (`__bundler/template`). Mode: **dark** (root element has `class="dark"`). All colors below are *computed* (rgb) unless shown as a token.

The mockup is built from inline styles + a handful of utility classes (`.pane`, `.pane-lite`, `.nav-item`, `.section-label`, `.segmented/.seg/.seg-count`, `.btn-glow`, `.btn-ghost`, `.search-field`, `.kbd`, `.row-hover`, `.workspace`, `.num`). Those classes' real CSS is reproduced in §10.

---

## 0. Tokens (resolved on the `.dark` root)

| Token | Value (HSL triplet) | ≈ rgb |
|---|---|---|
| `--background` | `240 33% 8%` | 14,14,27 |
| `--foreground` | `210 40% 98%` | 248,250,252 |
| `--card` / `--card-foreground` | `240 26% 11%` / `210 40% 98%` | |
| `--primary` | `263 83% 58%` | 127,59,237 (`#7f3bed`) |
| `--primary-foreground` | `0 0% 100%` | white |
| `--secondary` / `--accent` | `256 59% 26%` | |
| `--muted` | `240 25% 15%` | |
| `--muted-foreground` | `215 20% 65%` | 148,163,184 (`#94a3b8`) |
| `--border` / `--input` | `240 24% 15%` | 29,29,47 (default `*` border-color) |
| `--ring` | `263 83% 58%` | |
| `--success` | `142.1 70.6% 45.3%` | 34,197,94 |
| `--warning` | `47.9 95.8% 53.1%` | |
| `--destructive` | `0 62.8% 30.6%` | |
| `--page` | `240 38% 5.5%` | 9,9,19 |
| `--page-2` | `252 40% 7%` | |
| `--pane` | `240 28% 9.5%` | 17,17,31 |
| `--pane-2` | `240 26% 11%` | 21,21,35 |
| `--pane-border` | `245 22% 17%` | 35,34,53 |
| `--pane-border-2` | `250 28% 22%` | 46,40,72 |
| `--bevel-inner` | `240 30% 4%` | |
| `--soft-shadow` | `263 60% 6%` | |
| `--brand` / `--brand-2` | `263 83% 62%` / `280 75% 60%` | |
| `--mono` | `'JetBrains Mono',ui-monospace,monospace` | (set inline on root) |
| `--radius` | `0.75rem` (12px) | (not actually used by lobby elements — radii are hard-coded, see below) |

Other fixed colors used inline (not tokens): amber `rgb(227,182,69)` (progress bar), gold `rgb(241,208,126)`/`rgba(228,186,78,…)` (SIT & GO badge), green text `rgb(116,231,158)` (STARTS WHEN FULL), `rgb(82,224,134)` (+$3.42), `rgb(240,205,117)` (prize), `rgb(196,212,204)` / `rgb(173,194,184)` (hero secondary text), felt greens `rgb(36,96,71)→rgb(18,54,40)` etc.

Document base: `html, body { font-family: Inter, system-ui, sans-serif; background: hsl(var(--background)) → overridden to rgb(6,6,14); color: hsl(var(--foreground)); margin:0; -webkit-font-smoothing: antialiased }`, `* { border-color: hsl(var(--border)); box-sizing: border-box }`. Body/html computed bg = **rgb(6, 6, 14)**. `.nf-app` sets `font-feature-settings: "cv11","ss01"` (Inter alternates: single-storey a? cv11 = single-storey a, ss01 = open digits).

---

## 1. Page background + outer shell

`.nf-app` (page root): `display:flex; gap:10px; padding:10px; min-height:100vh; width:100%; position:relative; overflow:hidden; background-attachment:scroll (inline override of fixed)`.

- `background-color`: **rgb(9,9,19)** (= `hsl(var(--page))`)
- `background-image` (3 radial glows, dark variant):
  ```
  radial-gradient(1100px 700px at -10% 110%, hsl(263 80% 22% / 0.55), transparent 60%),
  radial-gradient(900px 600px at 110% -10%,  hsl(280 70% 24% / 0.32), transparent 55%),
  radial-gradient(600px 400px at 50% 120%,   hsl(252 80% 18% / 0.40), transparent 60%)
  ```
  computed: `rgba(46,11,101,.55)` bottom-left, `rgba(75,18,104,.32)` top-right, `rgba(24,9,83,.4)` bottom-center.
- Layout: two **separate rounded panes** side by side with a **10px gap** on a 10px-padded page: sidebar pane (232px) | right column `flex:1` containing `main.pane`.
- Right column wrapper: `flex:1 1 0; min-width:0; display:flex; flex-direction:column; gap:10px`.

### Sidebar pane (`aside.sidebar.pane`)
- `width:232px; flex-shrink:0; height: calc(100vh - 20px)` (880 @900); `position:sticky; top:10px; left:10px; z-index:20`
- `display:flex; flex-direction:column; padding:16px 12px; gap:4px`
- `background: linear-gradient(180deg, hsl(240 28% 10%) 0%, hsl(252 32% 8%) 100%)` → computed `linear-gradient(rgb(18,18,33), rgb(16,14,27))`
- `border: 1px solid hsl(var(--pane-border))` = **rgb(35,34,53)**; `border-radius: 16px`
- `box-shadow`: `0 0 0 0.5px rgba(77,36,143,.22), inset 0 1px 0 rgba(79,45,134,.18), inset 0 -1px 0 rgba(7,7,13,.5), 0 12px 32px -12px rgba(13,6,24,.6), 0 40px 80px -32px rgba(9,4,16,.9)`

### Main pane (`main.pane`)
- `flex:1; min-width:0; display:flex; flex-direction:column; padding:24px 28px; gap:22px` (x=252 at 1440, w=1178, h=910 — grows with content)
- `background: linear-gradient(180deg, hsl(240 28% 9.5%) 0%, hsl(240 26% 11%) 100%)` → `linear-gradient(rgb(17,17,31), rgb(21,21,35))`
- `border: 1px solid rgb(35,34,53)`; `border-radius: 16px`
- `box-shadow`: `inset 0 1px 0 rgba(79,45,134,.14), inset 0 -1px 0 rgba(7,7,13,.5), 0 1px 2px rgba(13,6,24,.5), 0 12px 32px -16px rgba(13,6,24,.8), 0 32px 64px -32px rgba(9,4,16,.9)`

---

## 2. Sidebar contents

**Brand block** (`.workspace`, first): `display:flex; align-items:center; gap:10px; padding:4px 8px 18px; cursor:pointer` (206×54).
- Logo square: **32×32**, `border-radius:9px`, `background: linear-gradient(135deg, rgb(127,59,237), rgb(167,60,221))`, text "52" `font: 800 13px/1 Inter; color:#fff; centered`, `box-shadow: inset 0 1px 0 rgba(224,204,255,.35)`.
- Text stack: `display:flex; flex-direction:column; gap:3px`
  - "Block52": `font: 700 15px/1 Inter; color: rgb(248,250,252)`
  - "Poker VM": `font: 400 11px/1 Inter; color: rgb(148,163,184)`

**Section labels** (`.section-label`): `font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em (=0.84px); color: rgb(148,163,184)`.
- "PLAY": `padding: 6px 10px`
- "NETWORK": `padding: 16px 10px 6px`

**Nav items** (`.nav-item`): `display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px; font: 500 13.5px Inter; color: rgb(148,163,184); transition: background 120ms, color 120ms`. Height 32.5 (active 34.5 due to 1px border). Icon: inline svg **15×15**, `stroke="currentColor" stroke-width="1.8" stroke-linecap/linejoin round`, icon color = muted `rgb(148,163,184)`.
- Hover (dark): `background: rgb(28,27,45)` (`hsl(245 25% 14%)`), `color: foreground`.
- **Active** (`.nav-item.active`, dark): `background: linear-gradient(180deg, hsl(263 83% 58% / .22) 0%, hsl(263 83% 58% / .08) 100%)`; `color: rgb(243,244,246)` (`hsl(220 14% 96%)`); `border: 1px solid rgba(139,78,239,.38)`; `box-shadow: inset 0 1px 0 rgba(194,162,246,.18), 0 2px 6px rgba(62,13,140,.28)`; active icon color `rgb(187,148,249)` (`hsl(263 90% 78%)`).
- Items, in order: PLAY → Lobby (monitor icon, active), Wallet, Hand history, Players; NETWORK → Block explorer, Hand distribution, **Nodes**, Tech notes; then `flex:1` spacer; Admin; then status chip. (Lucide-style icons, 24-viewBox paths in the template; `title` attr = label.)

**Admin**: same `.nav-item` (y≈789).

**Status chip** (`.workspace`, second): `margin-top:8px; padding:10px; border-radius:12px; border:1px solid rgb(35,34,53); background: rgb(25,24,37) (hsl(240 26% 11%)→ computed); display:flex; align-items:center; gap:10px` (206×49).
- Dot: `8×8; border-radius:50%; background: rgb(34,197,94) (hsl(var(--success))); box-shadow: 0 0 0 3px rgba(34,197,94,.18)` (static, no animation).
- Text stack `gap:4px`: "Mainnet" `font: 600 12px/1 Inter; color:#f8fafc`; "Block #1,284,512" `font: 400 11px/1 var(--mono) (JetBrains Mono); color: rgb(148,163,184)`.

---

## 3. Page header (inside main, `display:flex; align-items:center; gap:14px; flex-wrap:wrap`)

- Title block: `flex:1 1 240px; flex-direction:column; gap:6px`
  - "Lobby": `font: 700 28px/1.2 Inter; letter-spacing:-0.02em (-0.56px); color:#f8fafc` (h=33.6)
  - Subtitle: `font: 400 14px/1.4 Inter; color: rgb(148,163,184)` (h=19.6)
- **Search field** (`.search-field`): `height:40px; padding:0 12px; gap:8px; border-radius:10px; flex:1 1 220px; max-width:320px; min-width:0; display:flex; align-items:center; cursor:text`; `background: rgb(17,17,31) (hsl(var(--pane)))`; `border:1px solid rgb(35,34,53)`; `box-shadow: inset 0 1px 0 rgba(79,45,134,.16)` (dark). Focus-within (dark): `border-color: rgba(139,78,239,.5); box-shadow: inset 0 1px 0 rgba(79,45,134,.18), 0 0 0 3px rgba(133,68,238,.22)`; icon → `rgb(187,148,249)`.
  - Icon: 15×15 magnifier (`circle cx11 cy11 r8` + `m21 21-4.3-4.3`, stroke-width 2), color muted.
  - Placeholder text: `font: 400 13px/1 Inter; color: rgb(148,163,184); flex:1; ellipsis` — "Search table name or ID"
  - **kbd** `/`: `min-width:18px; height:18px; padding:0 5px; font: 500 10.5px/1 ui-monospace,SFMono-Regular,monospace; color: rgb(169,169,188); background: rgb(29,28,44); border:1px solid rgb(46,40,72); border-bottom-width:1.5px; border-radius:4px`.
- **Balance pill**: `display:flex; align-items:center; gap:10px; height:40px; padding: 0 5px 0 12px; border-radius:999px; border:1px solid rgb(35,34,53); background: rgb(17,17,31)` (168.5×40)
  - USDC icon: `<img>` **18×18** (svg 32×32 viewBox, circle fill `#3E73C4` + white glyph).
  - Amount: `font: 600 14px/1 Inter` ("$42.10"), class `num`.
  - **Deposit chip**: `font: 500 12px/1 Inter; padding: 8px 11px; border-radius:999px; background: rgb(31,30,47); cursor:pointer` (66×28), color foreground.
- **Avatar**: `40×40; border-radius:50%; background: linear-gradient(135deg, rgb(228,186,78), rgb(230,128,26)); font: 700 13px/1 Inter; color: rgb(65,32,6)`; text "7F" centered.
- Right cluster wrapper: `display:flex; align-items:center; gap:10px`.

---

## 4. Hero / featured card

Container grid: `display:grid; grid-template-columns: minmax(0,1.6fr) minmax(0,1fr); gap:14px` (1120 → 680.6 | 425.4).

**Hero card**: `position:relative; overflow:hidden; border-radius:16px; border:1px solid rgb(40,83,65); padding:22px; display:flex; flex-direction:column; gap:14px; min-height:220px`
- `background: radial-gradient(80% 120% at 85% 50%, rgb(31,81,60), rgb(11,34,26) 70%)` (single layer, no overlay).
- **Table illustration** (pure CSS ellipse, no SVG): absolutely positioned `right:-110px; top:30px; width:400px; height:165px; border-radius:999px; border:10px solid rgb(15,15,26); box-shadow: inset 0 0 0 2px rgba(221,175,60,.45), 0 20px 40px -10px #000; background: radial-gradient(at 50% 40%, rgb(36,96,71), rgb(18,54,40) 80%)`.
- **3 face-up cards**: wrapper `position:absolute; right:50px; top:84px; display:flex; gap:6px`; each `<img>` `width:42px` (height auto → 42×61.5, native 550×805 SVG), `border-radius:4px; box-shadow: 0 6px 14px -4px #000`. They are **separate SVG files** (A♠, K♠, 9♥) — extracted to `src/assets/lobby/card-ace-spades.svg`, `card-king-spades.svg`, `card-nine-hearts.svg`. (Each is a full vector card face with `clip-path`; ~4.8–6.2 KB.)
- Badges row: `display:flex; gap:8px; flex-wrap:wrap; position:relative`
  - "SIT & GO": `font: 600 10.5px/1 Inter; letter-spacing:0.08em; padding:5px 8px; border-radius:999px; background: rgba(228,186,78,.16); color: rgb(241,208,126); border:1px solid rgba(228,186,78,.3)` (69.6×22.5)
  - "STARTS WHEN FULL": same font/padding/radius, no border; `background: rgba(34,197,94,.14) (hsl(var(--success)/.14)); color: rgb(116,231,158)` (134.4×22.5)
- Text block: `position:relative; display:flex; flex-direction:column; gap:6px; max-width:330px`
  - Title "Friday Degens": `font: 700 24px/1.2 Inter; letter-spacing:-0.01em`
  - Description: `font: 400 13px/1.5 Inter; color: rgb(196,212,204); text-wrap:pretty`
- Footer row: `position:relative; display:flex; align-items:center; gap:18px; margin-top:auto; flex-wrap:wrap`
  - **Register button** (`.btn-glow.shimmer-hover`): `border:0; height:44px; padding:0 18px; border-radius:999px; font: 600 14px/1 Inter`; label "Register · $0.10" (139.8×44). Glow CSS in §10 (`background: linear-gradient(135deg, hsl(263 83% 60%), hsl(280 75% 58%))`, computed `rgb(133,68,238)→rgb(175,68,228)`, multi-layer shadow). Hover: `translateY(-1px)`, `brightness(1.06)`, stronger shadow; `.shimmer-hover::after` white sweep (`linear-gradient(90deg, transparent, rgba(255,255,255,.2), transparent)`, `translateX(-100%) skewX(-12deg)` → `translateX(100%)`, 500ms ease-in-out).
  - Meta stacks (`flex-direction:column; gap:4px`): label `.section-label` with color `rgb(173,194,184)` ("SEATS"/"PRIZE"); value `font: 600 14px/1 Inter` (`1 / 2`; prize `$0.18` in `rgb(240,205,117)`).

## 5. Stat cards (right column)

Wrapper: `display:grid; grid-template-columns: repeat(auto-fit, minmax(min(100%,240px),1fr)); gap:14px` (stacks vertically below ~494px column width; side-by-side at wider viewports — as in the user's own screenshot).

Both cards are `.pane-lite` with `padding:18px; display:flex; flex-direction:column; justify-content:space-between; gap:14px`:
- `.pane-lite` = `background: hsl(var(--pane)) = rgb(17,17,31); border:1px solid rgb(35,34,53); border-radius:14px`.
- **Your last session**: label `.section-label`; big number `font: 700 32px/1 Inter; color: rgb(82,224,134)` ("+$3.42"); sub `font: 400 12px/1.4 Inter; color: rgb(148,163,184)` ("38 hands · Table c1001 · 2h ago"); inner stack `gap:6px`.
- **Live now**: label `.section-label`; row `display:flex; gap:24px; flex-wrap:wrap`; each stat `flex-direction:column; gap:4px`: number `font: 700 24px/1 Inter`; label `font: 400 12px/1 Inter; color: rgb(148,163,184)` — "Open tables", "Seated", "Avg. block".

## 6. "Tables" header row

`display:flex; align-items:center; gap:12px; flex-wrap:wrap`.
- "Tables": `font: 600 20px/1.3 Inter; flex:1 1 auto`.
- Segmented wrapper `max-width:100%; overflow-x:auto`. **`.segmented`**: `display:inline-flex; align-items:center; gap:2px; padding:3px; border-radius:10px; background: rgb(25,24,37) (dark: hsl(245 22% 12%)→computed); border:1px solid rgb(35,34,53)` (232.5×36).
  - **`.seg`**: `display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 11px; border:0; border-radius:7px; background:transparent; color: rgb(148,163,184); font: 500 11.5px/1 Inter` (text, e.g. "Cash 5").
  - **`.seg.on`** (active): `background: hsl(var(--primary)) = rgb(127,59,237); color:#fff; box-shadow: 0 1px 2px rgba(13,6,24,.22), inset 0 1px 0 rgba(255,255,255,.12)`.
  - **`.seg-count`**: `min-width:17px; height:17px; padding:0 4px; border-radius:5px; font: 600 10.5px/1 Inter; tabular-nums; background: rgba(148,163,184,.14); color: rgb(148,163,184)`; on active: `background: rgba(255,255,255,.2); color:#fff`.
- **Create table** (`.btn-ghost`): `height:38px; padding:0 14px; border-radius:999px; font: 500 13px/1 Inter; display:flex; align-items:center; gap:6px; flex-shrink:0; white-space:nowrap`; `background: rgb(17,17,31); border:1px solid rgb(35,34,53); color:#f8fafc`; plus icon 14×14 (`M5 12h14 M12 5v14`, stroke-width 2). Hover (dark): `background: rgb(28,27,45); border-color: rgb(46,40,72)`.

## 7. Table list

Panel: `.pane-lite` + `overflow:hidden` (`bg rgb(17,17,31); border 1px rgb(35,34,53); radius 14px`). Full width 1120.

Grid template (header **and** rows): `grid-template-columns: minmax(0,2.2fr) minmax(0,1fr) minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.4fr) 110px; gap:12px` → at 1120: `289.5 | 131.6 | 171.1 | 131.6 | 184.2 | 110`.

- **Header row**: `padding:12px 20px; border-bottom:1px solid rgb(35,34,53) (pane-border)`; labels `.section-label` (10.5px/600/uppercase/0.84px/muted): Table, Format, Players, Blinds, Buy-in, *(empty — no label for action column)*. (No sort arrows, no Variant, no Table-ID header — it's "Table".)
- **Row** (`.row-hover`): `display:grid; align-items:center; padding:0 20px; min-height:60px; gap:12px; border-bottom:1px solid hsl(var(--pane-border)/.6) = rgba(35,34,53,.6); cursor:pointer`; hover (dark) `background-color: rgb(28,27,45)`; transition 120ms. Row height = 60.
- **Cell 1 — table identity**: `display:flex; align-items:center; gap:12px; min-width:0`
  - **Felt icon**: `34×22; flex-shrink:0; border-radius:999px; border:3px solid rgb(13,13,22); background: radial-gradient(rgb(39,104,77), rgb(18,54,40)); box-shadow: inset 0 0 0 1px rgba(221,175,60,.4)` (green felt "pill" with gold inner rim).
  - Text stack `flex-direction:column; gap:4px; min-width:0`:
    - Name: `font: 600 14px/1.1 Inter; nowrap; ellipsis` (h=15.4)
    - Subline: `font: 400 11.5px/1 var(--mono) → JetBrains Mono; color: rgb(148,163,184)` — format `"<shortid> · NLH"` (e.g. `0x7c…a3f9 · NLH`, `c1001 · NLH`).
- **Format**: `font: 500 13px/1 Inter; color: rgb(148,163,184)` — plain text "Cash" / "Sit & Go" (**no badge**).
- **Players**: `display:flex; align-items:center; gap:10px`:
  - Bar track `56×4; border-radius:2px; background: rgb(33,32,50); overflow:hidden`; fill `height:100%; width:<pct>%; background: rgb(227,182,69)` — **same amber for every state** (0%, 22%, 50%, 67%, even 100% full is amber, not red).
  - Count text: `font: 500 13px/1 Inter; color:#f8fafc` — `"4 / 6"` (spaces around slash).
- **Blinds**: `font: 500 13px/1 Inter; color:#f8fafc` — cash `"$0.01 / $0.02"`; Sit & Go `"10 / 20"` (chips, no `$`).
- **Buy-in**: `font: 500 13px/1 Inter; color: rgb(148,163,184)` — `"$1.00 – $2.00"` or single `"$0.10"` (no fee breakdown).
- **Action** (110px col): `display:flex; justify-content:flex-end`; button `.btn-ghost`: `height:34px; padding:0 14px; border-radius:999px; font: 600 12.5px/1 Inter` (Join 55.8×34); same bg/border/hover as Create table. Labels: **Join** (cash with seats), **Register** (Sit & Go), **Watch** (full table). Never a disabled "Full" chip.

Seed data in mockup (7 rows): High Rollers (Cash, 4/6 67%, $0.01/$0.02, $1.00–$2.00, Join), Friday Degens (Sit & Go, 1/2 50%, 10/20, $0.10, Register), Night Owls (Cash, 6/6 100%, $0.05/$0.10, $5.00–$10.00, Watch), Brisbane Turbo (Sit & Go, 4/6 67%, 25/50, $1.00, Register), Table 9d12e (Cash, 2/9 22%, $0.01/$0.02, $0.40–$2.00, Join), Micro Grind (Cash, 3/6 50%, $0.01/$0.02, $0.50–$2.00, Join), Deep Stack (Cash, 0/6 0%, $0.02/$0.05, $2.00–$5.00, Join). No pagination footer.

---

## 8. Fonts (embedded in the bundle — not CDN)

All fonts are **woff2 embedded in the bundle manifest** (28 files) and referenced from the template's `@font-face` blocks (Google-Fonts-style, split by `unicode-range`: cyrillic-ext, cyrillic, greek-ext, greek, vietnamese, latin-ext, latin).

| Family | Weights declared | Files | Note |
|---|---|---|---|
| **Inter** | 300, 400, 500, 600, 700 | 7 subset files, **each shared by all 5 weights** | = a **variable font** (wght axis); one file per subset covers every weight |
| **JetBrains Mono** | 400, 500, 600 | 6 subset files shared by 3 weights | variable (wght); used via `--mono` for subline + block number |
| IBM Plex Mono | 400 / 500 / 600 (separate static files) | 15 files | declared but **not used** by the Lobby (`--mono` = JetBrains Mono) — not extracted |

Extracted to **`src/assets/fonts/`** (verified `wOF2` magic bytes):
- `Inter-latin.woff2` (48,432 B) — `unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD` (includes `$ – · …`)
- `Inter-latin-ext.woff2` (85,272 B) — `U+0100-02BA, U+02BD-02C5, …`
- `JetBrainsMono-latin.woff2` (31,340 B), `JetBrainsMono-latin-ext.woff2` (11,596 B)

Suggested `@font-face` (one declaration per file with a weight *range*, since they're variable): `font-family:'Inter'; font-weight:300 700; font-display:swap; src:url(./fonts/Inter-latin.woff2) format('woff2'); unicode-range: <latin range above>` (+ latin-ext), and `font-family:'JetBrains Mono'; font-weight:400 600`.

Also extracted to `src/assets/lobby/`: `usdc.svg` (32×32 USDC glyph, `#3E73C4`), `card-ace-spades.svg`, `card-king-spades.svg`, `card-nine-hearts.svg` (550×805 each; render at `width:42px`).

**`.num` quirk**: `.num { font-variant-numeric: tabular-nums }` exists but every `.num` element sets the inline `font:` shorthand, which resets `font-variant-numeric` → effectively **proportional Inter numerals**. The `.mono-nums .num` mono override is inactive (no `.mono-nums` ancestor). Only the status-chip block number and the table sublines use JetBrains Mono (explicit `var(--mono)`).

---

## 9. Depth / effects summary

- Panes: 5-layer bevel shadows (see §1). `.pane-lite` has **no shadow**.
- Hero: radial green gradient bg; ellipse `inset 0 0 0 2px rgba(221,175,60,.45), 0 20px 40px -10px #000`; cards `0 6px 14px -4px #000`.
- Primary glow button & active nav use colored (violet) shadows; no `backdrop-filter`/blur anywhere in the lobby.
- Transitions: nav/row/btn-ghost 120ms ease; btn-glow 120ms (transform/box-shadow/filter); search 140ms; shimmer 500ms.

---

## 10. Source CSS of the mockup's utility classes (dark mode values inlined)

```css
.pane { background: linear-gradient(180deg, hsl(240 28% 9.5%) 0%, hsl(240 26% 11%) 100%);
  border:1px solid hsl(245 22% 17%); border-radius:16px;
  box-shadow: inset 0 1px 0 hsl(263 50% 35%/.14), inset 0 -1px 0 hsl(240 30% 4%/.5),
    0 1px 2px hsl(263 60% 6%/.5), 0 12px 32px -16px hsl(263 60% 6%/.8), 0 32px 64px -32px hsl(263 60% 4%/.9); }
.pane-lite { background: hsl(240 28% 9.5%); border:1px solid hsl(245 22% 17%); border-radius:14px; }
.sidebar.pane { background: linear-gradient(180deg, hsl(240 28% 10%) 0%, hsl(252 32% 8%) 100%);
  box-shadow: 0 0 0 .5px hsl(263 60% 35%/.22), inset 0 1px 0 hsl(263 50% 35%/.18),
    inset 0 -1px 0 hsl(240 30% 4%/.5), 0 12px 32px -12px hsl(263 60% 6%/.6), 0 40px 80px -32px hsl(263 60% 4%/.9); }
.nav-item { position:relative; display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px;
  font-size:13.5px; font-weight:500; color:hsl(215 20% 65%); transition: background 120ms ease, color 120ms ease; }
.dark .nav-item:hover { background: hsl(245 25% 14%); }
.dark .nav-item.active { background: linear-gradient(180deg, hsl(263 83% 58%/.22) 0%, hsl(263 83% 58%/.08) 100%);
  color: hsl(220 14% 96%); border:1px solid hsl(263 83% 62%/.38);
  box-shadow: inset 0 1px 0 hsl(263 83% 80%/.18), 0 2px 6px hsl(263 83% 30%/.28); }
.nav-item .nav-icon { color: hsl(215 20% 65%); }  .dark .nav-item.active .nav-icon { color: hsl(263 90% 78%); }
.section-label { font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.08em; color:hsl(215 20% 65%); }
.segmented { display:inline-flex; align-items:center; gap:2px; padding:3px; border-radius:10px;
  background: hsl(245 22% 12%); border:1px solid hsl(245 22% 17%); }
.seg { display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 11px; border:0; border-radius:7px;
  background:transparent; color:hsl(215 20% 65%); font:500 11.5px/1 Inter,sans-serif; cursor:pointer; transition: color 120ms, background 120ms; }
.seg.on { background: hsl(263 83% 58%); color:#fff; box-shadow: 0 1px 2px hsl(263 60% 6%/.22), inset 0 1px 0 hsl(0 0% 100%/.12); }
.seg-count { display:inline-flex; align-items:center; justify-content:center; min-width:17px; height:17px; padding:0 4px;
  border-radius:5px; font:600 10.5px/1 Inter; font-variant-numeric:tabular-nums;
  background: hsl(215 20% 65%/.14); color: hsl(215 20% 65%); }
.seg.on .seg-count { background: hsl(0 0% 100%/.2); color:#fff; }
.btn-glow { background: linear-gradient(135deg, hsl(263 83% 60%) 0%, hsl(280 75% 58%) 100%); color:#fff;
  box-shadow: inset 0 1px 0 hsl(263 100% 90%/.35), inset 0 -1px 0 hsl(263 80% 30%/.5), 0 1px 2px hsl(263 80% 20%/.5),
    0 8px 20px -6px hsl(263 90% 50%/.45), 0 0 0 1px hsl(263 83% 70%/.25);
  transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease; }
.btn-glow:hover { transform: translateY(-1px); filter: brightness(1.06);
  box-shadow: inset 0 1px 0 hsl(263 100% 90%/.45), inset 0 -1px 0 hsl(263 80% 30%/.5), 0 2px 4px hsl(263 80% 20%/.5),
    0 12px 28px -6px hsl(263 90% 55%/.6), 0 0 0 1px hsl(263 83% 70%/.35); }
.btn-ghost { background: hsl(240 28% 9.5%); border:1px solid hsl(245 22% 17%); color:hsl(210 40% 98%); transition: background 120ms, border-color 120ms; }
.dark .btn-ghost:hover { background: hsl(245 25% 14%); border-color: hsl(250 28% 22%); }
.search-field { background: hsl(240 28% 9.5%); border:1px solid hsl(245 22% 17%); cursor:text; transition: border-color 140ms, box-shadow 140ms, background 140ms; }
.dark .search-field { box-shadow: inset 0 1px 0 hsl(263 50% 35%/.16); }
.dark .search-field:focus-within { border-color: hsl(263 83% 62%/.5); box-shadow: inset 0 1px 0 hsl(263 50% 35%/.18), 0 0 0 3px hsl(263 83% 60%/.22); }
.kbd { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 5px;
  font:500 10.5px/1 ui-monospace,SFMono-Regular,monospace; color:hsl(240 12% 70%); background:hsl(245 22% 14%);
  border:1px solid hsl(250 28% 22%); border-bottom-width:1.5px; border-radius:4px; }
.row-hover { transition: background-color 120ms ease; }  .dark .row-hover:hover { background-color: hsl(245 25% 14%); }
```

---

## 11. Notes for the match pass (observed deltas vs. the current app screenshot)

- Mockup is **two floating rounded panes** (sidebar + main, 16px radius, 10px page padding & gap, layered violet shadows), not a flat sidebar + page. Page bg is `rgb(9,9,19)` + 3 violet radial glows (current app uses animated orbs/hex grid).
- Brand block is a violet gradient "52" square + "Block52 / Poker VM" (current app: text logo). Status chip is a bordered card (Mainnet + mono block number), not a bare line.
- Hero card has the **green felt ellipse + 3 face-up card SVGs** and a glow-gradient Register button; badges are 10.5px/0.08em pills (gold SIT & GO, green STARTS WHEN FULL).
- Table list has **no Variant/Table-ID/Action headers, no sort arrows, no pagination, no "Full" chip**; rows are 60px with a felt-pill icon + name over mono subline; Format is plain text; players bar is always amber; actions are ghost pills (Join / Register / Watch).
- Filter control is a **segmented** track (active = filled violet) — not separate pills — and "Create table" is a ghost pill next to it.
- Type: **Inter variable** (latin) with `cv11, ss01` features, base 13–14px UI text; JetBrains Mono only for sublines + block number; headings use negative letter-spacing (-0.02em title, -0.01em hero).
