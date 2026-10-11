import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";

/**
 * Place-1-first player ids of a finished Sit & Go, from the state's results. Passed with the prize settle so
 * the chain can recompute payouts from its own prize-pool math if its recorded results are missing.
 * Empty when the state has no results (cash games, unfinished tournaments).
 */
export function finishingOrderFromState(gameState: TexasHoldemStateDTO | undefined): string[] {
    const results = gameState?.results;
    if (results === undefined || results.length === 0) return [];
    return [...results].sort((a, b) => a.place - b.place).map(r => r.playerId);
}
