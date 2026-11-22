import { afterEach, describe, expect, it, vi } from "vitest";
import { indexerApi, orderCardStats, presentResult, type CardStats } from "./indexer";

afterEach(() => {
    vi.unstubAllGlobals();
});

function serve(body: unknown) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }));
}

describe("paged endpoints", () => {
    it("turn an empty page sent as data: null into an empty list", async () => {
        serve({ data: null, pagination: { limit: 20, offset: 0, total: 0 } });
        const sessions = await indexerApi.getPlayerSessions("b521x", 20, 0);
        expect(sessions).toEqual({ data: [], pagination: { limit: 20, offset: 0, total: 0 } });

        const hands = await indexerApi.getHandsForGame("0xnone", 25, 0);
        expect(hands.data).toEqual([]);
    });

    it("pass rows through unchanged", async () => {
        const row = { game_id: "0xg", hand_number: 3, block_height: 9, deck_seed: "s", created_at: "2026-11-21T00:00:00Z" };
        serve({ data: [row], pagination: { limit: 25, offset: 0, total: 1 } });
        const hands = await indexerApi.getRecentHands(25, 0);
        expect(hands).toEqual({ data: [row], pagination: { limit: 25, offset: 0, total: 1 } });
    });
});

const stat = (card: string, rank: string, suit: string): CardStats => ({
    card,
    rank,
    suit,
    total_appearances: 0,
    expected_frequency: 0,
    actual_frequency: 0,
    deviation: 0,
    deviation_percent: 0,
});

describe("orderCardStats", () => {
    it("orders suit-major (c, d, h, s) then rank 2..A", () => {
        const ordered = orderCardStats([stat("As", "A", "s"), stat("2h", "2", "h"), stat("Kc", "K", "c"), stat("2c", "2", "c"), stat("Td", "T", "d")]);
        expect(ordered.map(c => c.card)).toEqual(["2c", "Kc", "Td", "2h", "As"]);
    });

    it("does not mutate its input", () => {
        const input = [stat("As", "A", "s"), stat("2c", "2", "c")];
        orderCardStats(input);
        expect(input[0].card).toBe("As");
    });
});

describe("presentResult", () => {
    it("maps known results", () => {
        expect(presentResult("PASS")).toEqual({ label: "Consistent with fair", tone: "ok" });
        expect(presentResult("MARGINAL").tone).toBe("warn");
        expect(presentResult("FAIL").tone).toBe("bad");
        expect(presentResult("NO_DATA").tone).toBe("mute");
    });

    it("shows unknown results verbatim", () => {
        expect(presentResult("WEIRD")).toEqual({ label: "WEIRD", tone: "mute" });
    });
});
