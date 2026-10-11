import { Deck, PlayerStatus, PokerSolver, TexasHoldemRound, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";

/** Monte Carlo runs per simulation; the result is cached per hands+board so it runs once per street. */
const EQUITY_ITERATIONS = 5000;

const IN_HAND_STATUSES: ReadonlySet<PlayerStatus> = new Set([PlayerStatus.ACTIVE, PlayerStatus.ALL_IN, PlayerStatus.SHOWING]);

interface EquityInput {
    hands: Array<{ seat: number; cards: string[] }>;
    board: string[];
}

function isRealCard(code: string): boolean {
    return code !== "" && code !== "??" && code !== "XX" && code.length >= 2;
}

/**
 * Whose cards are known and when equity is worth showing: either everyone still in the hand is all-in (or
 * already showing) with visible cards, or the hand is at showdown with two or more revealed hands.
 * Returns null otherwise.
 */
export function equityInput(state: TexasHoldemStateDTO | undefined): EquityInput | null {
    if (state === undefined) return null;

    const inHand = state.players.filter(player => IN_HAND_STATUSES.has(player.status));
    const visible = inHand.flatMap(player =>
        player.holeCards !== undefined && player.holeCards.length === 2 && player.holeCards.every(isRealCard)
            ? [{ seat: player.seat, cards: player.holeCards }]
            : []
    );
    if (visible.length < 2) return null;

    const allInShowdownless = inHand.every(player => player.status === PlayerStatus.ALL_IN || player.status === PlayerStatus.SHOWING);
    const allVisible = visible.length === inHand.length;
    const isShowdown = state.round === TexasHoldemRound.SHOWDOWN || state.round === TexasHoldemRound.END;
    if (!(allInShowdownless && allVisible) && !isShowdown) return null;

    return { hands: visible, board: state.communityCards.filter(isRealCard) };
}

/** Win percentage (0-100) for each seat in the input, via the SDK's Monte Carlo solver. */
export function computeEquities(input: EquityInput): Map<number, number> {
    const hands = input.hands.map(hand => hand.cards.map(code => Deck.fromString(code)));
    const board = input.board.map(code => Deck.fromString(code));
    const { winPercentages } = PokerSolver.calculateMultiPlayerEquity(hands, board, EQUITY_ITERATIONS);

    const bySeat = new Map<number, number>();
    input.hands.forEach((hand, index) => bySeat.set(hand.seat, winPercentages[index]));
    return bySeat;
}
