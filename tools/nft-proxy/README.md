# NFT proxy

A tiny Cloudflare Worker that returns the NFTs an Ethereum address owns, so the Alchemy API key lives on a server
and not inside every installer. It is a separate deploy unit; the desktop app only needs its URL.

```
GET https://<your-worker>/?owner=0x…              first page
GET https://<your-worker>/?owner=0x…&pageKey=…    next page
```

The response is Alchemy's `getNFTsForOwner` JSON, which `src/utils/nftAvatar.ts` already understands.

## What it does and does not do

- Accepts only `GET`, a 40-hex-digit `owner`, and an optional short `pageKey` made of URL-safe characters.
- Builds the Alchemy URL itself (fixed host, fixed path, fixed `pageSize`), so a caller cannot reach any other
  Alchemy method or any other host.
- Caches each answer for 60 seconds and never forwards upstream error bodies (they can contain the key).
- Is open to anyone: the data is public on-chain data. Protect your quota with a rate limit (below).

## Deploy

```bash
cd tools/nft-proxy
npx wrangler login
npx wrangler secret put ALCHEMY_KEY      # paste a dedicated key (Ethereum mainnet only enabled)
npx wrangler deploy                      # prints https://block52-nft-proxy.<you>.workers.dev
```

Then, in the Cloudflare dashboard, add a rate limiting rule for the Worker's route (for example 30 requests per
minute per IP).

## Use it in the app

Set a repository **variable** (not a secret, it is just a URL) for the release build:

```
VITE_PROFILE_NFT_INDEXER_URL=https://block52-nft-proxy.<you>.workers.dev/?owner={owner}
```

Remove `VITE_MAINNET_RPC_URL` from the `release` environment so the key is in no installer. The app's CSP picks up
the host automatically. For local development put the same line in `.env`.

## Test

The tests run with the rest of the suite (`yarn test`); they call the handler with a stubbed Alchemy.
