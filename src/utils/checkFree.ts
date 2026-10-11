import { TexasHoldemRound, type ActionDTO, type PlayerDTO } from "@block52/poker-vm-sdk";

/** Actions that move chips into the pot. */
const CHIP_ACTIONS = new Set<string>(["post-small-blind", "post-big-blind", "bet", "call", "raise", "all-in"]);

/** Chips a player committed in the current betting round (preflop counts the blinds posted in the ante round). */
export function currentRoundContribution(playerId: string, round: string, previousActions: readonly ActionDTO[]): bigint {
    const isPreflop = round === TexasHoldemRound.ANTE || round === TexasHoldemRound.PREFLOP;
    return previousActions
        .filter(
            a =>
                a.playerId === playerId &&
                (isPreflop ? a.round === TexasHoldemRound.ANTE || a.round === TexasHoldemRound.PREFLOP : a.round === round) &&
                CHIP_ACTIONS.has(a.action) &&
                a.amount !== "" &&
                a.amount !== "0"
        )
        .reduce((sum, a) => sum + BigInt(a.amount), 0n);
}

/**
 * True when checking is free for `address` right now: nobody has committed more chips this round than they have.
 * The preflop big blind stays check-free until someone raises; other preflop seats are facing the blind.
 */
export function isCheckFreeForPlayer(
    players: readonly PlayerDTO[],
    address: string,
    round: string,
    previousActions: readonly ActionDTO[]
): boolean {
    const mine = currentRoundContribution(address, round, previousActions);
    const highest = players.reduce((max, p) => {
        const contribution = currentRoundContribution(p.address, round, previousActions);
        return contribution > max ? contribution : max;
    }, 0n);
    return mine >= highest;
}
