import { describe, expect, it } from "vitest";
import { orderCardStats, presentResult, type CardStats } from "./indexer";

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
