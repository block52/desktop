import { describe, expect, it, vi } from "vitest";
import { HAND_SEARCH_QUERY, buildHandSearch, describeHttpFailure, parseHandSearch, searchHands } from "./handSearch";

const ROW = { game_id: "0x522af6-t1", hand_number: 29, block_height: 1_134_000, deck_seed: "seed", indexed_at: "2026-11-18T10:45:05Z" };

describe("buildHandSearch", () => {
    it("matches the text in a table id or a player's address, as a variable", () => {
        const { query, variables } = buildHandSearch("  0x522af6  ", 25, 0);
        expect(query).toBe(HAND_SEARCH_QUERY);
        expect(variables).toEqual({
            where: { _or: [{ game_id: { _ilike: "%0x522af6%" } }, { players: { player_address: { _ilike: "%0x522af6%" } } }] },
            limit: 25,
            offset: 0,
        });
    });

    it("accepts tournament table ids and full addresses", () => {
        expect(() => buildHandSearch("0x522af6f3faa14816649c2e24a6ab3b951d56b5e85f7cb8803fe72f1a0127a80b-t1", 25, 0)).not.toThrow();
        expect(() => buildHandSearch("b521p0tkyws8c7pcqtcpw65pj2jk0674qwvzd7x3j6", 25, 0)).not.toThrow();
    });

    it("refuses anything that is not an id or address, including LIKE wildcards", () => {
        for (const text of ["", "   ", "%", "a_b", "x'; drop", "two words", "a".repeat(101), 5, null]) {
            expect(() => buildHandSearch(text, 25, 0)).toThrow(/table id or a player address/);
        }
    });

    it("refuses bad paging", () => {
        expect(() => buildHandSearch("0x1", 0, 0)).toThrow(/page size/);
        expect(() => buildHandSearch("0x1", 101, 0)).toThrow(/page size/);
        expect(() => buildHandSearch("0x1", 25, -1)).toThrow(/page/);
        expect(() => buildHandSearch("0x1", 2.5, 0)).toThrow(/page size/);
    });
});

describe("parseHandSearch", () => {
    it("maps rows to the list's hands, using indexed_at as the time", () => {
        const result = parseHandSearch({ data: { poker_hands: [ROW], total: { aggregate: { count: 108 } } } });
        expect(result).toEqual({
            hands: [{ game_id: "0x522af6-t1", hand_number: 29, block_height: 1_134_000, deck_seed: "seed", created_at: "2026-11-18T10:45:05Z" }],
            total: 108,
        });
    });

    it("reports the indexer's own error", () => {
        expect(() => parseHandSearch({ errors: [{ message: "statement timeout: narrow the query" }] })).toThrow(/statement timeout/);
    });

    it("refuses a response of the wrong shape", () => {
        expect(() => parseHandSearch({ data: { poker_hands: [{ game_id: 1 }], total: { aggregate: { count: 1 } } } })).toThrow(/unexpected/);
        expect(() => parseHandSearch(null)).toThrow(/unexpected/);
    });
});

describe("searchHands", () => {
    it("posts to /graphql with the key as a bearer token", async () => {
        const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: { poker_hands: [ROW], total: { aggregate: { count: 1 } } } }) }));
        const result = await searchHands({ indexerUrl: "https://indexer.example/", apiKey: "test-key", fetch }, "0x522af6", 25, 0);
        expect(result.total).toBe(1);
        const [url, init] = fetch.mock.calls[0] as unknown as [string, { method: string; headers: Record<string, string>; body: string }];
        expect(url).toBe("https://indexer.example/graphql");
        expect(init.method).toBe("POST");
        expect(init.headers.Authorization).toBe("Bearer test-key");
        expect(JSON.parse(init.body).variables.where._or[0].game_id._ilike).toBe("%0x522af6%");
    });

    it("turns HTTP failures into readable messages and never sends a refused search", async () => {
        const refused = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
        await expect(searchHands({ indexerUrl: "https://i", apiKey: "k", fetch: refused }, "0x1", 25, 0)).rejects.toThrow(/refused this build's API key/);
        const never = vi.fn();
        await expect(searchHands({ indexerUrl: "https://i", apiKey: "k", fetch: never }, "a%b", 25, 0)).rejects.toThrow();
        expect(never).not.toHaveBeenCalled();
    });

    it("describes rate limits and other statuses", () => {
        expect(describeHttpFailure(429)).toMatch(/rate limit/);
        expect(describeHttpFailure(500)).toMatch(/HTTP 500/);
    });
});
