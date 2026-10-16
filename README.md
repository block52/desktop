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
| `VITE_PAYMENT_PROXY_URL` | Crypto deposit proxy (defaults to the Block52 hosted proxy) |
| `VITE_SNG_SCHEDULE_URL` | Weekly Sit & Go schedule JSON |
| `VITE_TREASURY_WALLET_ADDRESS` | Treasury wallet address |
| `VITE_PROFILE_NFT_INDEXER_URL` | NFT listing for the avatar picker: URL template with `{owner}` / `{chainId}` |
| `VITE_MAINNET_RPC_URL` | Alternative NFT source: an Alchemy mainnet RPC URL (ships the key in the app; prefer the proxy in [`tools/nft-proxy`](tools/nft-proxy)) |

## Project layout

```
src/main.ts            Electron main process (window, CSP, external links)
src/preload.ts         Context-isolated bridge exposed to the renderer
src/renderer.ts        Renderer entry, mounts src/app.tsx
src/pages/             Route pages (lobby, table, wallet, history, explorer, ...)
src/components/        UI grouped by domain (table, wallet, modal, nodes, ...)
src/hooks/             Data and game hooks (player actions live in hooks/playerActions)
src/context/           Network, wallet, toast and game-state providers
src/utils/             Pure helpers (currency, tournament state, cosmos client, ...)
```

Three Vite configs build the three Electron contexts (`vite.main.config.ts`, `vite.preload.config.ts`,
`vite.renderer.config.ts`). Code that uses Node or Electron APIs must stay in the main process and be exposed
through `preload.ts`. See [`CLAUDE.md`](CLAUDE.md) for conventions and the design-reference notes.

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
