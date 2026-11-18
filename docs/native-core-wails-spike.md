# Spike: a Go-native core for the desktop app (Wails), with gRPC to the nodes

**Status:** design only — no code. Tracks [desktop#30](https://github.com/block52/desktop/issues/30).
**Decision wanted:** whether the next major version of this app moves off Electron to a
Go-native shell (Wails), and where the chain/signing boundary sits.

---

## 1. Why look at this now

The app today is Electron + Vite + React. Everything — UI, chain reads, wallet, signing — runs
in the renderer (a browser). That has three costs we keep paying:

1. **Chain access lives in the renderer.** ~every page reads the node directly (balances, game
   list, game state, explorer, hand history). The renderer also holds the Cosmos wallet and
   signs. A browser context is the worst place for key material and for chain plumbing.
2. **Electron is heavy.** Full Chromium + Node per install; large binaries; a security-fuse
   dance at package time (`asar`, `RunAsNode`/`NodeOptions`/`NodeCliInspect` disabled — see
   `forge.config.ts`).
3. **Two languages for chain logic.** The TypeScript SDK (`@block52/poker-vm-sdk`) re-implements
   what the chain already has in Go. We maintain the widening (e.g. `OfflineDirectSigner`) twice.

Meanwhile the **block52-club** project already designed the architecture we'd want — a Go signer
and gRPC reads behind a thin front end. OpenBazaar's new client took the same native-core shape
(theirs in Rust/Tauri). This spike asks: do the same here, with **Go** (Wails), reusing the Go
work we're already doing.

## 2. Reference architecture (what club already decided)

From [block52-club#54](https://github.com/Dzeezbtc/block52-club/issues/54) and
[#48](https://github.com/Dzeezbtc/block52-club/issues/48):

```
                    ┌──► club API (TypeScript)  — everything that is NOT a game action
                    │          └─ gRPC ─► pokerchain node  (reads: balances, tables, history)
  front end ────────┤
                    └──► Go signer            — game actions only
                               └─ gRPC ─► pokerchain node  (writes: signs then broadcasts)
```

- **Reads** go to the node over **gRPC** where a method/decoder exists, REST otherwise.
- **Writes** (game actions) go through a **Go signer** that holds the key, enforces policy, signs
  with the chain's own Go types, and broadcasts. The front end never holds the key.
- The signer has **no generic "sign this"** — only `Perform` (action/join/leave/top-up) and
  `WsAuth`. Withdrawals/bank/bridge are out of scope by construction.

The club app is a web FE talking to **remote** Go/TS services. The desktop app is different in one
way that matters: it is **self-custodial and local-first** — the wallet lives on the user's
machine. So the desktop version of this picture collapses the two remote services into **one local
Go core** embedded in the app.

## 3. The proposal for desktop: Wails (Go core + webview UI)

```
┌───────────────────────── Wails app (one binary) ─────────────────────────┐
│                                                                           │
│   React UI (webview)                 Go core (native)                     │
│   ─ @block52/ui-sdk primitives       ─ wallet: keystore, seal/unseal      │
│   ─ pages, table, wallet UI    ◄──►  ─ signer: Perform / WsAuth (gRPC)    │
│   ─ no chain access, no keys    Wails ─ chain reads over gRPC             │
│                                 bind  ─ table subscription (gRPC stream)  │
└───────────────────────────────────────────────────────────────────────────┘
                                          └─ gRPC ─► pokerchain node
```

- **UI stays React/TypeScript.** This is why the `@block52/ui-sdk` extraction matters: the
  primitives are already a standalone package with no Electron/Node coupling, so they drop into a
  Wails webview unchanged. The ui-sdk work is **not throwaway** under this plan — it is the UI
  layer of the native app.
- **Go core owns:** the keystore and sealing, the signer (the club#48 `Perform`/`WsAuth`
  contract, but local — JWT/mTLS auth becomes "same process"), chain reads over gRPC, and the
  table stream. It uses the chain's own Go client — no TS SDK in the hot path.
- **Wails binding** replaces Electron's `preload.ts` IPC: Go methods are called from JS as
  promises; Go can emit events to the UI (the table-state stream becomes a Wails event feed).

### What moves, per current surface

| Area (today, in renderer)                         | Under Wails                                  |
|---------------------------------------------------|----------------------------------------------|
| `utils/cosmos/*` (wallet, client, signing, seal)  | **Go core** (keystore + signer)              |
| chain reads: balances, game list, game state      | **Go core** gRPC reads, bound to the UI      |
| `TransactionPanel`, explorer, hand history/replay | **Go core** reads; UI just renders           |
| table WebSocket subscription                       | **Go core** gRPC stream → Wails events       |
| game actions (fold/call/raise/join/leave/top-up)   | **Go core** signer (`Perform`)               |
| deposit/withdraw via web3 (reown/wagmi/viem)       | **stays in UI** (EVM bridge is browser-side) |
| all presentational UI, routing, pages              | **stays React** (`@block52/ui-sdk` + app)    |

Note the EVM deposit/withdraw flow (reown/wagmi/viem) is genuinely browser/wallet-connector
territory and should stay in the webview; only the **Cosmos/pokerchain** side moves to Go.

## 4. Engine comparison

| | **Wails (Go)** | Tauri (Rust) | Stay on Electron |
|---|---|---|---|
| Core language | **Go** — matches the chain, the signer design (club#48), the Go PVM engine port | Rust | TS/Node |
| UI | system webview (React unchanged) | system webview (React unchanged) | bundled Chromium |
| Binary size | small (no bundled browser) | smallest | large |
| Chain client | **native Go client, no TS SDK** | would need Rust bindings or FFI | TS SDK in renderer |
| Signing off the UI thread | **yes, in Go** | yes, in Rust | no (renderer event loop) |
| Team fit | **high** — we already write Go | low (new language) | current |
| webview consistency | OS-dependent (WebView2/WKWebView/WebKitGTK) | same caveat | uniform Chromium |
| Reference | — | OpenBazaar's new client | — |

**Recommendation: Wails.** The deciding factor is that the native work is *already happening in
Go* — the signer contract (club#48), the gRPC read layer (club#54), and the Go PVM engine port.
Rust (Tauri) is more mature as a shell and is what OpenBazaar chose, but it would mean a second
systems language and re-deriving the chain client. The one real Wails risk is webview divergence
across OSes; mitigated by keeping the UI to the `@block52/ui-sdk` primitives + standard React and
testing on all three targets.

## 5. Migration path (phased, each phase shippable)

0. **(done / in flight)** Extract `@block52/ui-sdk` — the thin UI layer, shell-agnostic.
1. **Define the gRPC surface** the app needs: reads (balance, tx list, game list, game state) and
   the table stream. Reuse club#54's decoders where they exist; list the missing ones.
2. **Stand up the Go core** as a library with the club#48 signer contract (`Perform`, `WsAuth`)
   and the read methods — behind an interface, testable without a UI.
3. **Wails shell**: new target that loads the existing React UI in a webview, with the Go core
   bound. Keep Electron building in parallel until parity.
4. **Move reads** off the renderer onto Go-core bindings, one surface at a time (balances →
   tx list → game list/state → explorer/history). Same order club#54 is doing.
5. **Move signing**: game actions go through the Go signer; remove `utils/cosmos` signing and the
   TS SDK from the hot path.
6. **Cut over**: when parity holds on all three OSes, Wails becomes the shipped app; retire the
   Electron target and its fuse/asar config.

Withdrawals (club#48 defers them; they need the key + an approval proof) get their own Go-core RPC
designed before cutover — do not drop the current web3 withdraw flow until it exists.

## 6. Open questions (for sign-off)

- **Table transport:** gRPC server-stream → Wails events, or keep a WebSocket the Go core relays?
  (club#54 left the equivalent open.)
- **Keystore format:** reuse the current seal/`walletSession` scheme in Go, or adopt the club's
  KEK-sealed model adapted for local single-user?
- **gRPC decoder gap:** how many poker messages still lack a Go decoder/endpoint (blocks moving
  table views and tx history off REST)?
- **webview floor:** minimum OS/webview versions we support, and the CI matrix to test them.
- **Scope of v1 native:** cash-table play only first, or full parity (tournaments, explorer,
  hand distribution) before cutover?

## 7. Recommendation

Proceed with a **Wails spike branch** after `@block52/ui-sdk` ships: build phase 1–3 (gRPC surface,
Go core library with the signer contract, Wails shell loading today's UI) behind a feature target,
Electron untouched. Reassess at phase 3 with a real cross-OS build before committing to the cutover.
