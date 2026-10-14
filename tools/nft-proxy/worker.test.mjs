import { describe, expect, it, vi } from "vitest";
import { buildUpstreamUrl, handleRequest, normalizeKey } from "./worker.js";

const OWNER = "0x1111111111111111111111111111111111111111";
const ENV = { ALCHEMY_KEY: "test-key-123" };

function get(query) {
    return new Request(`https://nft-proxy.example.com/?${query}`);
}

function upstreamJson(body, status = 200) {
    return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("nft proxy", () => {
    it("forwards a valid owner to Alchemy with the key and fixed parameters", async () => {
        const upstream = upstreamJson({ ownedNfts: [] });

        const response = await handleRequest(get(`owner=${OWNER}`), ENV, upstream);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ownedNfts: [] });
        const url = new URL(upstream.mock.calls[0][0]);
        expect(url.origin + url.pathname).toBe("https://eth-mainnet.g.alchemy.com/nft/v3/test-key-123/getNFTsForOwner");
        expect(url.searchParams.get("owner")).toBe(OWNER);
        expect(url.searchParams.get("pageSize")).toBe("100");
    });

    it("passes a page key through", async () => {
        const upstream = upstreamJson({ ownedNfts: [] });

        await handleRequest(get(`owner=${OWNER}&pageKey=abc_123`), ENV, upstream);

        expect(new URL(upstream.mock.calls[0][0]).searchParams.get("pageKey")).toBe("abc_123");
    });

    it("rejects an owner that is not an address, without calling Alchemy", async () => {
        const upstream = upstreamJson({});

        for (const owner of ["", "vitalik.eth", "0x123", `${OWNER}00`, "../../etc"]) {
            const response = await handleRequest(get(`owner=${encodeURIComponent(owner)}`), ENV, upstream);
            expect(response.status).toBe(400);
        }
        expect(upstream).not.toHaveBeenCalled();
    });

    it("rejects a page key that could change the upstream request", async () => {
        const upstream = upstreamJson({});

        const response = await handleRequest(get(`owner=${OWNER}&pageKey=${encodeURIComponent("x&owner=0x2")}`), ENV, upstream);

        expect(response.status).toBe(400);
        expect(upstream).not.toHaveBeenCalled();
    });

    it("only allows GET and answers preflight", async () => {
        const upstream = upstreamJson({});

        expect((await handleRequest(new Request("https://x/", { method: "POST" }), ENV, upstream)).status).toBe(405);
        expect((await handleRequest(new Request("https://x/", { method: "OPTIONS" }), ENV, upstream)).status).toBe(204);
    });

    it("does not leak the upstream error body, which can contain the key", async () => {
        const upstream = vi.fn(async () => new Response("bad request for https://…/v3/test-key-123/getNFTsForOwner", { status: 400 }));

        const response = await handleRequest(get(`owner=${OWNER}`), ENV, upstream);

        expect(response.status).toBe(502);
        const text = await response.text();
        expect(text).not.toContain("test-key-123");
        expect(text).toContain("Alchemy answered 400");
    });

    it("tolerates a key pasted with whitespace or as the whole Alchemy URL", async () => {
        expect(normalizeKey("  abc123\n")).toBe("abc123");
        expect(normalizeKey("https://eth-mainnet.g.alchemy.com/v2/abc123")).toBe("abc123");
        expect(normalizeKey("https://eth-mainnet.g.alchemy.com/nft/v3/abc123/")).toBe("abc123");
        expect(normalizeKey(undefined)).toBe("");

        const upstream = upstreamJson({ ownedNfts: [] });
        await handleRequest(get(`owner=${OWNER}`), { ALCHEMY_KEY: "https://eth-mainnet.g.alchemy.com/v2/abc123" }, upstream);
        expect(new URL(upstream.mock.calls[0][0]).pathname).toBe("/nft/v3/abc123/getNFTsForOwner");
    });

    it("passes rate limiting on to the app", async () => {
        const response = await handleRequest(get(`owner=${OWNER}`), ENV, upstreamJson({}, 429));

        expect(response.status).toBe(429);
    });

    it("fails closed when the key is not configured", async () => {
        const response = await handleRequest(get(`owner=${OWNER}`), {}, upstreamJson({}));

        expect(response.status).toBe(500);
    });

    it("builds URLs only under the Alchemy NFT API host", () => {
        expect(buildUpstreamUrl("k", OWNER, null).host).toBe("eth-mainnet.g.alchemy.com");
    });
});
