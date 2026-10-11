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

## Inherited Rules

This project is part of the Block52 poker-vm monorepo. When integrating with the blockchain/game layer:

- **Package manager**: Use `yarn`, never `npm install`
- **Quotes**: Always use double quotes (`"`) in TypeScript/TSX
- **SDK types**: Import from `@block52/poker-vm-sdk` — never define duplicate types
- **No defaults policy**: Never use `||` or `??` as fallbacks for SDK values — let missing data error loudly
- **No `any` type**: Use SDK types; see [poker-vm CLAUDE.md](../poker-vm/CLAUDE.md) for full 12 Commandments
- **Git workflow**: Always branch from `main`, never push directly — all changes via PRs
