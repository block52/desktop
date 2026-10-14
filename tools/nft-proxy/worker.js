// Small Cloudflare Worker that lists the NFTs an address owns, so the Alchemy key stays on the server instead
// of inside every installer. The desktop app calls it through VITE_PROFILE_NFT_INDEXER_URL.
//
//   GET /?owner=0x…            first page
//   GET /?owner=0x…&pageKey=…  next page
//
// The response is Alchemy's getNFTsForOwner JSON, which is what src/utils/nftAvatar.ts already reads.

const ALCHEMY_NFT_API = "https://eth-mainnet.g.alchemy.com/nft/v3";
const OWNER_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const PAGE_KEY_PATTERN = /^[A-Za-z0-9_\-=.]{1,300}$/;
const PAGE_SIZE = "100";
const CACHE_SECONDS = 60;

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
};

function reply(body, status, extraHeaders = {}) {
    return new Response(body, { status, headers: { ...CORS_HEADERS, ...extraHeaders } });
}

/** Builds the Alchemy URL from validated parts only, so the caller can't steer the request anywhere else. */
export function buildUpstreamUrl(key, owner, pageKey) {
    const url = new URL(`${ALCHEMY_NFT_API}/${key}/getNFTsForOwner`);
    url.searchParams.set("owner", owner);
    url.searchParams.set("withMetadata", "true");
    url.searchParams.set("pageSize", PAGE_SIZE);
    if (pageKey !== null) url.searchParams.set("pageKey", pageKey);
    return url;
}

export async function handleRequest(request, env, upstreamFetch = fetch) {
    if (request.method === "OPTIONS") return reply(null, 204);
    if (request.method !== "GET") return reply("Method not allowed", 405);
    if (typeof env.ALCHEMY_KEY !== "string" || env.ALCHEMY_KEY === "") return reply("Not configured", 500);

    const params = new URL(request.url).searchParams;
    const owner = params.get("owner") ?? "";
    if (!OWNER_PATTERN.test(owner)) return reply("Invalid owner", 400);

    const pageKey = params.get("pageKey");
    if (pageKey !== null && !PAGE_KEY_PATTERN.test(pageKey)) return reply("Invalid pageKey", 400);

    let upstream;
    try {
        upstream = await upstreamFetch(buildUpstreamUrl(env.ALCHEMY_KEY, owner, pageKey).toString(), {
            headers: { Accept: "application/json" },
            cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
        });
    } catch {
        return reply("Upstream unavailable", 502);
    }

    // Pass the data through; never echo upstream error bodies, which can include the request URL (and the key).
    if (!upstream.ok) return reply("Upstream error", upstream.status === 429 ? 429 : 502);
    return reply(upstream.body, 200, {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
    });
}

export default {
    fetch: (request, env) => handleRequest(request, env),
};
