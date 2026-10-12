import { PlayerStatus, TexasHoldemRound, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";

/**
 * A Sit & Go is over once results are recorded and either the table reached its END frame or only one
 * player is left standing (the chain can leave a finished table parked at ANTE with the winner "active").
 */
export function isTournamentFinished(state: TexasHoldemStateDTO, isTournament: boolean): boolean {
    if (!isTournament || state.results.length === 0) return false;
    const survivors = state.players.filter(player => player.status !== PlayerStatus.BUSTED);
    return state.round === TexasHoldemRound.END || survivors.length <= 1;
}

/** The single player still standing in a finished tournament; null while several remain. */
export function tournamentSurvivor(state: TexasHoldemStateDTO): string | null {
    const survivors = state.players.filter(player => player.status !== PlayerStatus.BUSTED);
    return survivors.length === 1 ? survivors[0].address : null;
}
