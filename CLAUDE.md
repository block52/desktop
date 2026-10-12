# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

This is the Electron desktop app for the Block52 poker platform, part of the `poker-vm` monorepo. It wraps the React UI in an Electron shell for distribution as a native desktop application.

## Commands

```bash
yarn start          # Run in development (Electron Forge + Vite HMR)
yarn package        # Package app without installer
yarn make           # Build installers for current platform
yarn lint           # Lint TypeScript/TSX files
```

## Architecture

Electron has three distinct contexts — all three are built by Vite via `electron-forge`:

| File | Context | Purpose |
|------|---------|---------|
| `src/main.ts` | Main process (Node.js) | Creates `BrowserWindow`, lifecycle events |
| `src/preload.ts` | Preload (sandboxed Node.js) | IPC bridge between main and renderer |
| `src/renderer.ts` → `src/app.tsx` | Renderer (browser) | React UI root |

Each context has its own Vite config (`vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`) and **cannot share code that uses the other's APIs**.

**IPC pattern**: Any Node.js/Electron API needed by the renderer must be exposed through `preload.ts` via `contextBridge.exposeInMainWorld()`. Never enable `nodeIntegration: true` in the renderer.

## Build Output

Vite outputs to `.vite/build/` (main/preload) and `.vite/renderer/` (renderer). The forge config uses `asar: true` with security fuses — `RunAsNode`, `NodeOptionsEnvironmentVariable`, and `NodeCliInspectArguments` are all disabled at package time.

## Design Reference

The UI is ported from a design mockup: `~/Downloads/Block52 Redesign.html` (bundled single-file HTML app — open it in a browser, or grep the `<sc-if value="{{ isX }}">` blocks per screen; dark-theme tokens live in its `:root` `.dark` block).

**Standing rule: after completing any UI task, compare the result against this mock before calling it done.** Verify color tokens (`--card 240 26% 11`, `--popover 240 26% 10`, `--primary 263 83% 58`, `--muted-foreground 215 20% 65`, `--pane-border 245 22% 17`), utility-class patterns (`.pane-lite`, `.section-label`, `.row-hover`, `.btn-ghost`/`.btn-glow` pills, `.segmented`/`.seg`, `.search-field`), and the mock's copy pattern (labeled pill buttons: `btn-ghost`, 36px, `border-radius: 999px`, 13px medium).

Known intentional divergences — do not "fix" these when comparing:

- **Admin**: exists in the mock, deliberately disabled in the app sidebar (nav item renders disabled, no route)
- **Players**: `/players` directory + `/players/:address` profile built from the indexer API; the mock's 7d/30d/All-time range switch and per-player Sessions column have no indexer equivalent (sorting by hands/rake/net and a Rake column instead; profile adds VPIP/PFR/WTSD tiles and session history)
- **Wallet**: layout matches the mock (Available card + segmented Deposit/Withdraw switching the inline panel, Activity list from real `listWithdrawalRequests` data); the mock's QR-deposit rows have no equivalent in the real bridge flow (approve/deposit via web3 instead), "At tables" / "Lifetime net" rows have no data source — keys section is an app addition below the fold
- **Hand distribution**: mock is a shuffle-fairness audit (chi-squared, frequency bars) — built from the indexer API (`VITE_INDEXER_URL`, default `https://indexer.block52.xyz`) as the default tab, with the Monte Carlo equity calculator kept as a second tab (an app addition). Adds suit/rank chi-squared tests and a duplicate-seed note from the web explorer page; the mock's Verdict/χ²/p-value/Cards-dealt tiles show "No data yet" until the indexer has revealed cards
- **Nodes**: app manages RPC network endpoints; mock lists validators
- **Lobby**: adds a Mine tab (tables you created, marked by an accent bar and "by you"), per-row Playing / Waiting / Finished status badges, a creator line instead of the small id, newest-first order, and 15/30/50-per-page pagination
- **Create table**: web-parity form (game type, name validation, blind/buy-in presets, calculated range, creation-fee preview) — the mock's dialog is simpler
- **Wallet**: refresh button, copyable address, and a transfers + withdrawals activity feed (the mock shows withdrawals only)
- **Block explorer**: shared pagination (15/30/50) on every tab
- **Dashboard**: the hero is a slider (live featured Sit & Go, then the next scheduled tournaments from the web repo's `sng-schedule.json`; Register opens the link in the system browser, https only); "Your last session" and My hands are real indexer data, fetched when the page opens (My hands falls back to the wallet's table sessions when the indexer has no hands attributed to it)
- **Table**: ported from the web app rather than the mock — web card/chip art, win and turn ripples, seat banner (last action, turn clock, WINS / place), Modern / Classic / Nouns themes, Sit & Go strip (blind level, next blinds, prizes), play settings menu (auto fold / muck / pre-check / sounds), pre-select check, sit-out boxes, add chips, leave confirmation, Sit & Go prize claim, auto-reconnect banner, live hand strength, and action / turn sounds

## Code conventions

This repo follows its own existing style (`interface` for props, `function` declarations for utilities, `export default` components, `src/utils/`, flat `components/<domain>/` folders, relative imports) rather than the shared gates' stricter rules (type-only, arrow functions, named exports, no `utils/`, `components/<Name>/<Name>.tsx`, `@/` alias). Match the surrounding code; don't mix styles inside a file. Don't export a symbol that nothing else imports.

## Inherited Rules

This project is part of the Block52 poker-vm monorepo. When integrating with the blockchain/game layer:

- **Package manager**: Use `yarn`, never `npm install`
- **Quotes**: Always use double quotes (`"`) in TypeScript/TSX
- **SDK types**: Import from `@block52/poker-vm-sdk` — never define duplicate types
- **No defaults policy**: Never use `||` or `??` as fallbacks for SDK values — let missing data error loudly
- **No `any` type**: Use SDK types; see [poker-vm CLAUDE.md](../poker-vm/CLAUDE.md) for full 12 Commandments
- **Git workflow**: Always branch from `main`, never push directly — all changes via PRs
