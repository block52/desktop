# Block52 Poker Desktop

The native desktop client for [Block52](https://block52.xyz) poker: a self-custodial wallet, a live table
lobby, and real-time play against the Block52 chain, packaged as an Electron app for macOS, Windows and Linux.

> **Status:** early release, installers are not code-signed yet. Treat it as beta software and don't keep more
> than you are willing to lose in a wallet whose seed phrase is stored on your machine.

## Features

- **Lobby**: cash tables and Sit & Go tournaments with live status (Playing / Waiting / Finished), filters,
  search, and your own tables.
- **Table play**: a full Texas Hold'em table with turn timer, auto-actions, live hand strength, all-in equity,
  Sit & Go blind levels and prize claim, plus Modern / Classic / Nouns card themes.
- **Wallet**: a built-in Block52 wallet (24-word seed phrase), send USDC, deposit from a Web3 wallet through the
  bridge or by crypto QR payment, withdraw to Ethereum, and an on-chain NFT table avatar.
- **Hand history and replay**: your hands, a table's hands, or the whole network's, with deck seed and replay.
- **Explorer and network**: blocks, transactions, validators, nodes and hand-distribution fairness stats.
- **Players**: a directory and profiles built from the Block52 indexer.

## Requirements

- Node.js **24** or newer (see `.nvmrc`; `fnm use` / `nvm use` picks it up)
- [Yarn 1](https://classic.yarnpkg.com/) (`npm install` is not supported)

## Getting started

```bash
yarn install
cp .env.example .env     # optional, see Configuration
yarn start               # Electron Forge + Vite with hot reload
```

| Command | What it does |
|---|---|
| `yarn start` | Run the app in development with HMR |
| `yarn test` | Run the unit tests (vitest) |
| `yarn lint` | Lint TypeScript/TSX |
| `yarn typecheck` | Type-check without emitting |
| `yarn package` | Build the app without an installer (`out/`) |
| `yarn make` | Build installers for the current platform (`out/make/`) |

## Configuration

Settings are `VITE_*` variables read at build time (see [`.env.example`](.env.example)). All are optional unless
noted. **They are baked into the shipped bundle, so never put a secret you are not willing to publish into one.**

| Variable | Purpose |
|---|---|
| `VITE_PROJECT_ID` | WalletConnect / Reown project id, needed for the Web3 wallet button |
| `VITE_INDEXER_URL` | Block52 indexer (defaults to `https://indexer.block52.xyz`) |
| `VITE_INDEXER_API_KEY` | Indexer GraphQL key for Hand history search; set from the `INDEXER_API_KEY` repo secret in release builds. Empty means no search. Treat it as readable by anyone with the app (read-only, rate-limited) |
| `VITE_SNG_SCHEDULE_URL` | Weekly Sit & Go schedule JSON |
| `VITE_TREASURY_WALLET_ADDRESS` | Treasury wallet address |
| `VITE_PROFILE_NFT_INDEXER_URL` | NFT listing for the avatar picker: URL template with `{owner}` / `{chainId}` |
| `VITE_MAINNET_RPC_URL` | Alternative NFT source: an Alchemy mainnet RPC URL (ships the key in the app; prefer the proxy in [`tools/nft-proxy`](tools/nft-proxy)) |
| `VITE_GO_SIGNER` | `true` routes game actions (bet/call/raise/join/leave/top-up) through the Go wallet sidecar instead of the TypeScript SDK. Default off. See [Architecture](#architecture). |

## Project layout

```
src/main.ts            Electron main process (window, CSP, external links)
src/preload.ts         Context-isolated bridge exposed to the renderer
src/renderer.ts        Renderer entry, mounts src/app.tsx
src/pages/             Route pages (lobby, table, wallet, history, explorer, ...)
src/components/        UI grouped by domain (table, wallet, modal, nodes, ...)
src/hooks/             Data and game hooks (player actions live in hooks/playerActions)
src/context/           Network, wallet, toast and game-state providers
src/wallet/            Main-process wallet: sealed vault, signer, Go-sidecar client (goSidecar.ts)
src/utils/             Pure helpers (currency, tournament state, cosmos client, ...)
sidecar/               Go wallet sidecar (see Architecture); built to sidecar/dist/b52-wallet
```

Three Vite configs build the three Electron contexts (`vite.main.config.ts`, `vite.preload.config.ts`,
`vite.renderer.config.ts`). Code that uses Node or Electron APIs must stay in the main process and be exposed
through `preload.ts`. See [`CLAUDE.md`](CLAUDE.md) for conventions and the design-reference notes.

## Architecture

The app is Electron + React. Presentational UI primitives come from the shared
[`@block52/ui-sdk`](https://github.com/block52/ui-sdk) package; the wallet and chain crypto run in a **Go
sidecar** rather than in the renderer.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Electron                                                                  │
│                                                                           │
│  Renderer (React, sandboxed)          Main process (Node)                 │
│   • pages / components                 • window, CSP, IPC handlers         │
│   • @block52/ui-sdk primitives         • src/wallet: sealed vault + signer │
│   • NO keys, NO Node APIs   ──IPC──►    • spawns the Go sidecar ──────────┐│
└──────────────────────────────────────────────────────────────────────────┘│
                                                                             ▼
                                   ┌──────────────────────────────────────────┐
                                   │ Go sidecar  (sidecar/ → b52-wallet)        │
                                   │  github.com/block52/pokerchain-go-client   │
                                   │  • wallet: BIP39/BIP44 generate + derive   │
                                   │  • keys:   address, Sign64, EIP-191 sign   │
                                   │  • chain:  reads + sign/broadcast (gRPC)   │
                                   │  • lightnode: last-1000-blocks window      │
                                   │  JSON over stdin/stdout — no network port  │
                                   └──────────────────────────────────────────┘
                                                                             │ gRPC / Tendermint RPC
                                                                             ▼
                                                                     pokerchain node
```

**The Go sidecar is real and already wired.** `src/wallet/goSidecar.ts` (main process) spawns the
`sidecar/dist/b52-wallet` binary and talks to it as line-delimited JSON over stdin/stdout — it never opens a
network port and never persists anything. The binary is a thin `main.go` over the shared
[`pokerchain-go-client`](https://github.com/block52/pokerchain-go-client) module (packages `wallet`, `keys`,
`chain`, `lightnode`). Its output matches the TypeScript SDK / ethers byte-for-byte (address derivation and the
EIP-191 table-query signature are golden-tested against the SDK).

What runs in Go today:

- **Wallet** — generate (BIP39), derive the key at `m/44'/118'/0'/0/0`, address, and the `pokerchain-query`
  signature. These are the default (`src/wallet/walletIpc.ts` routes `generate` / `import` / `get-address` /
  `sign-query` to the sidecar).
- **Recent blocks** — a rolling 1000-block window polled from Tendermint RPC (`recentBlocks`).
- **Game actions** — signed and broadcast via the sidecar **behind `VITE_GO_SIGNER=true`**; the TypeScript SDK
  path is the default until the Go path is validated against a live node. It follows the SDK's own models:
  - bet/call/raise/fold/deal/… (`action`) are **unordered** transactions, like `performActionSync` (no account
    sequence; the chain de-duplicates on signer + timeout). They return once the node accepts them (CheckTx).
  - join/leave/top-up are **ordered** (account sequence, 1,000,000 gas like the SDK), then the sidecar waits until
    the chain has committed the tx and reports a failed execution. A Sit & Go claim sends its finishing order with
    the leave so the chain can work out payouts.
  - **sendTokens** (a bank transfer) is signed by the sidecar the same ordered, confirmed way, under the same flag. The
    main process still asks in a native confirmation dialog first, and the sidecar only signs as its own wallet: it
    refuses another sender, a zero amount, a malformed denom and any recipient that is not a valid `b52` address.
    It is deliberately not reachable through the game-action IPC channel, which has no confirmation.

The sealed seed vault and the OS keychain stay in the Electron main process (`src/wallet/vault.ts`); a mnemonic
only crosses to the sidecar in memory, per call. Forge builds the binary in `generateAssets` and bundles it via
`extraResource`, so it ships inside the packaged app.

### Build the sidecar for local dev

`yarn start` does not build the Go binary. Build it once (and after any `sidecar/` change):

```bash
cd sidecar && go build -o dist/b52-wallet .
# Windows: the binary needs the .exe extension
cd sidecar && go build -o dist/b52-wallet.exe .
```

Requires Go (see `sidecar/go.mod`). In a packaged build Forge handles this automatically, using the same name
(`src/wallet/sidecarBinary.ts`).

## CI/CD

GitHub Actions (`.github/workflows`):

| Workflow | Trigger | What it does |
|---|---|---|
| **CI** | pull requests, pushes to `main` | lint, typecheck, tests, a full `yarn package` build, and a dependency audit |
| **CodeQL** | pull requests, `main`, weekly | static security analysis |
| **Cut release** | manual | bumps the version, commits, tags and starts the installer build |
| **Release** | `v*` tag, or manual | builds macOS (arm64), Windows and Linux installers and drafts a GitHub release |

Reusable steps live in `.github/actions` (Node and yarn setup, Linux packaging tools, draft release).
Dependabot opens weekly update PRs.

### Releasing

1. In GitHub, open **Actions → Cut release → Run workflow** and choose `patch`, `minor` or `major`.
2. The workflow bumps `package.json`, commits to `main`, tags `vX.Y.Z`, and starts **Release**.
3. When the build finishes, review the draft release on the Releases page and publish it.

The tag must match the version in `package.json`; the Release workflow fails otherwise. For the build to include
your own settings, define the `VITE_*` values as repository **variables** and `VITE_MAINNET_RPC_URL` as a
repository **secret** (Settings → Secrets and variables → Actions).

The installer build runs in a `release` [environment](https://docs.github.com/actions/deployment/targeting-different-environments).
For a public repository, create it under Settings → Environments, restrict deployments to `main` and `v*` tags,
require a reviewer, and keep `VITE_MAINNET_RPC_URL` there as an environment secret so only approved release
builds can read it. The secret is exposed to the `yarn make` step only, not to dependency install scripts.

## Updates

The app checks this repository's latest published release at start and every few hours. When a newer version
exists it shows a notice with a **Download** button that opens the release page in the system browser; nothing is
downloaded or installed by the app itself. The check needs the repository to be public (a private repository's
releases need a token, which the app does not carry) and any failure simply shows no notice.

## Security notes

- The wallet's seed phrase is encrypted on disk with your operating system's secure storage (macOS Keychain,
  Windows DPAPI, Linux keyring) and signing happens in the app's main process, so the web page never holds the key.
  You can add a password, Touch ID unlock (macOS) and auto-lock under Wallet → Wallet keys → Security. Sending funds,
  withdrawing and bonding a validator ask for confirmation in a native dialog. Back up the seed phrase: a lost
  password cannot be recovered. On a Linux machine without a keyring the phrase is only obfuscated, so set a password.
- Installers are **not signed or notarized** yet, so macOS Gatekeeper and Windows SmartScreen will warn on first
  launch.
- Never share your seed phrase. Block52 will never ask for it.

To report a vulnerability, please open a private security advisory on GitHub rather than a public issue.

## License

[CC0 1.0](LICENSE)
