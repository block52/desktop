import { describe, expect, it } from "vitest";
import type { ActionDTO, PlayerDTO } from "@block52/poker-vm-sdk";
import { isCheckFreeForPlayer } from "./checkFree";

const act = (playerId: string, action: string, amount: string, round: string) => ({ playerId, action, amount, round }) as ActionDTO;
const players = [{ address: "sb" }, { address: "bb" }] as PlayerDTO[];

describe("isCheckFreeForPlayer", () => {
    const blinds = [act("sb", "post-small-blind", "10", "ante"), act("bb", "post-big-blind", "20", "ante")];

    it("preflop: the big blind is check-free, the small blind is facing the blind", () => {
        expect(isCheckFreeForPlayer(players, "bb", "preflop", blinds)).toBe(true);
        expect(isCheckFreeForPlayer(players, "sb", "preflop", blinds)).toBe(false);
    });

    it("preflop: a raise takes the big blind's free check away", () => {
        const raised = [...blinds, act("sb", "raise", "40", "preflop")];
        expect(isCheckFreeForPlayer(players, "bb", "preflop", raised)).toBe(false);
    });

    it("postflop: only the current round counts", () => {
        expect(isCheckFreeForPlayer(players, "sb", "flop", blinds)).toBe(true);
        const bet = [...blinds, act("bb", "bet", "50", "flop")];
        expect(isCheckFreeForPlayer(players, "sb", "flop", bet)).toBe(false);
        expect(isCheckFreeForPlayer(players, "bb", "flop", bet)).toBe(true);
    });
});
