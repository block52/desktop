import { describe, expect, it } from "vitest";
import type { IndexedHand, PlayerSession } from "./indexer";
import { handsInSession } from "./sessionHands";

const hand = (game_id: string, hand_number: number, block_height: number): IndexedHand => ({
    game_id,
    hand_number,
    block_height,
    deck_seed: "",
    created_at: "2026-10-11T08:00:00Z"
});

const session = (join_block: number, leave_block?: number): PlayerSession => ({
    player_address: "b521",
    game_id: "g1",
    join_block,
    leave_block,
    buy_in_amount: 400000,
    created_at: "2026-10-11T08:00:00Z"
});

describe("handsInSession", () => {
    const hands = [hand("g1", 1, 100), hand("g1", 2, 150), hand("g1", 3, 200), hand("g2", 1, 160)];

    it("keeps the table's hands that finished while the player was seated, newest first", () => {
        const result = handsInSession(session(120, 180), hands);
        expect(result.map(h => h.hand_number)).toEqual([2]);
    });

    it("is open-ended while the player is still seated", () => {
        expect(handsInSession(session(120), hands).map(h => h.hand_number)).toEqual([3, 2]);
    });

    it("ignores other tables and marks the hands as estimated", () => {
        const result = handsInSession(session(0), hands);
        expect(result.every(h => h.game_id === "g1" && h.estimated === true)).toBe(true);
    });
});
