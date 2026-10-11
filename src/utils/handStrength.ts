import { Deck, PokerGameIntegration, PokerSolver } from "@block52/poker-vm-sdk";

/**
 * Plain-language strength of the player's hand from their hole cards and the board ("Pair of Aces",
 * "A high"), for 2 to 7 cards. Null until both hole cards are known, or when a code is not a real card
 * (hidden cards arrive as "X" placeholders).
 */
export function describeHandStrength(holeCards: readonly string[] | undefined, communityCards: readonly string[]): string | null {
    if (holeCards === undefined || holeCards.length < 2) return null;
    const all = [...holeCards, ...communityCards];
    try {
        const cards = all.map(code => Deck.fromString(code));
        const evaluation = PokerSolver.evaluatePartialHand(cards);
        return all.length === 2 ? evaluation.description : PokerGameIntegration.formatHandDescription(evaluation);
    } catch {
        return null;
    }
}
