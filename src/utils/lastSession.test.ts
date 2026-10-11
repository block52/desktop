import { describe, expect, it } from "vitest";
import type { PlayerSession } from "./indexer";
import { summariseSession } from "./lastSession";

const base: PlayerSession = {
    player_address: "b521",
    game_id: "0x684ca1660de457287ec284976fce98dab68dc8bc44e00439831212e3025ec169",
    join_block: 100,
    leave_block: 200,
    buy_in_amount: 400_000,
    cash_out_amount: 760_000,
    created_at: "2026-10-11T08:00:00Z"
};
const NOW = Date.parse("2026-10-11T10:00:00Z");

describe("summariseSession", () => {
    it("shows a winning session's net and when it was", () => {
        expect(summariseSession(base, 12, NOW)).toEqual({
            net: "+$0.36",
            tone: "won",
            summary: "12 hands · Table 0x684c…c169 · 2h ago"
        });
    });

    it("shows a loss with its sign", () => {
        const lost = summariseSession({ ...base, cash_out_amount: 360_000 }, 1, NOW);
        expect(lost.net).toBe("-$0.04");
        expect(lost.tone).toBe("lost");
        expect(lost.summary.startsWith("1 hand ·")).toBe(true);
    });

    it("shows a session that is still going as in play", () => {
        const open = summariseSession({ ...base, leave_block: undefined, cash_out_amount: undefined }, null, NOW);
        expect(open.net).toBe("In play");
        expect(open.summary).toBe("Table 0x684c…c169 · 2h ago");
    });
});
