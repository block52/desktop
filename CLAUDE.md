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

## Inherited Rules

This project is part of the Block52 poker-vm monorepo. When integrating with the blockchain/game layer:

- **Package manager**: Use `yarn`, never `npm install`
- **Quotes**: Always use double quotes (`"`) in TypeScript/TSX
- **SDK types**: Import from `@block52/poker-vm-sdk` — never define duplicate types
- **No defaults policy**: Never use `||` or `??` as fallbacks for SDK values — let missing data error loudly
- **No `any` type**: Use SDK types; see [poker-vm CLAUDE.md](../poker-vm/CLAUDE.md) for full 12 Commandments
- **Git workflow**: Always branch from `main`, never push directly — all changes via PRs
