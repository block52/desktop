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

/** The key as pasted: trimmed, and if the whole Alchemy URL was pasted, just its last path segment. */
export function normalizeKey(value) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    return trimmed.includes("/") ? trimmed.replace(/\/+$/, "").split("/").pop() : trimmed;
}

export async function handleRequest(request, env, upstreamFetch = fetch) {
    if (request.method === "OPTIONS") return reply(null, 204);
    if (request.method !== "GET") return reply("Method not allowed", 405);
    const key = normalizeKey(env.ALCHEMY_KEY);
    if (key === "") return reply("Not configured", 500);

    const params = new URL(request.url).searchParams;
    const owner = params.get("owner") ?? "";
    if (!OWNER_PATTERN.test(owner)) return reply("Invalid owner", 400);

    const pageKey = params.get("pageKey");
    if (pageKey !== null && !PAGE_KEY_PATTERN.test(pageKey)) return reply("Invalid pageKey", 400);

    let upstream;
    try {
        upstream = await upstreamFetch(buildUpstreamUrl(key, owner, pageKey).toString(), {
            headers: { Accept: "application/json" },
            cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
        });
    } catch {
        return reply("Upstream unavailable", 502);
    }

    // Pass the data through. The upstream error body is never echoed (it can include the request URL, and the
    // key), but its status code is, which is enough to tell a bad key (401/403) from a disabled API (400/404).
    if (!upstream.ok) return reply(`Upstream error (Alchemy answered ${upstream.status})`, upstream.status === 429 ? 429 : 502);
    return reply(upstream.body, 200, {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
    });
}

export default {
    fetch: (request, env) => handleRequest(request, env),
};
