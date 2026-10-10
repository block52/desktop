import { describe, expect, it } from "vitest";
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import {
    buildReplaySteps,
    decodeStringField1,
    encodeStringField1,
    handEndedQuery,
    parseAbciStringResponse,
    parseGameStateJson,
    parseTxSearchHeight,
    snapshotHeights
} from "./handReplay";

function stateWith(actions: Array<{ action: string; round: string }>, board: string[]): TexasHoldemStateDTO {
    return {
        handNumber: 7,
        communityCards: board,
        previousActions: actions.map((a, index) => ({ index, seat: 1, playerId: "b52x", amount: "0", ...a }))
    } as unknown as TexasHoldemStateDTO;
}

describe("handReplay queries", () => {
    it("builds the hand_ended query and rejects unsafe ids", () => {
        expect(handEndedQuery("0xabc", 3)).toBe("hand_ended.game_id='0xabc' AND hand_ended.hand_number='3'");
        expect(() => handEndedQuery("0x'; DROP", 3)).toThrow();
        expect(() => handEndedQuery("0xabc", 0)).toThrow();
    });

    it("reads the height of the first tx_search result", () => {
        expect(parseTxSearchHeight({ result: { txs: [{ height: "42" }] } })).toBe(42);
        expect(parseTxSearchHeight({ result: { txs: [] } })).toBeNull();
        expect(parseTxSearchHeight(null)).toBeNull();
    });

    it("tries the end block, then the one before it", () => {
        expect(snapshotHeights(10)).toEqual([10, 9]);
        expect(snapshotHeights(1)).toEqual([1]);
    });
});

describe("abci string codec", () => {
    it("round-trips a string field", () => {
        const hex = encodeStringField1("0xtable");
        const bytes = hex.slice(2).match(/../g)!.map(h => parseInt(h, 16));
        const base64 = btoa(String.fromCharCode(...bytes));
        expect(decodeStringField1(base64)).toBe("0xtable");
    });

    it("surfaces the node's error log", () => {
        expect(() => parseAbciStringResponse({ result: { response: { code: 1, log: "version does not exist" } } })).toThrow("version does not exist");
    });
});

describe("parseGameStateJson", () => {
    it("accepts a nested or bare state", () => {
        expect(parseGameStateJson(JSON.stringify({ gameState: { handNumber: 4 }, format: "cash" })).state.handNumber).toBe(4);
        expect(parseGameStateJson(JSON.stringify({ handNumber: 5 })).state.handNumber).toBe(5);
        expect(() => parseGameStateJson("{}")).toThrow();
    });
});

describe("buildReplaySteps", () => {
    it("grows the board by street and skips table events", () => {
        const state = stateWith(
            [
                { action: "join", round: "ante" },
                { action: "post-small-blind", round: "preflop" },
                { action: "call", round: "preflop" },
                { action: "bet", round: "flop" },
                { action: "check", round: "river" }
            ],
            ["AS", "KD", "AD", "10H", "6D"]
        );
        const steps = buildReplaySteps(state);
        expect(steps.map(s => s.board.length)).toEqual([0, 0, 0, 3, 5]);
        expect(steps[0].action).toBeNull();
        expect(steps).toHaveLength(5);
    });

    it("adds a showdown step when the board completed after the last action", () => {
        const steps = buildReplaySteps(stateWith([{ action: "call", round: "preflop" }], ["AS", "KD", "AD", "10H", "6D"]));
        expect(steps[steps.length - 1]).toMatchObject({ street: "Showdown", action: null });
        expect(steps[steps.length - 1].board).toHaveLength(5);
    });
});
