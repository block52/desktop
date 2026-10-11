/**
 * Pot-sized bet / raise-to for a fraction of the pot, in the same unit as the inputs (dollars or chips).
 *
 * Facing a bet: CALL + fraction × (CALL + POT), i.e. a raise measured on the pot as it stands after you
 * call. First to act: fraction × POT, never below the big blind (a quarter of a tiny pot can round under
 * the smallest legal open).
 */
export function potBetAmount(fraction: number, pot: number, callAmount: number, bigBlind: number): number {
    if (callAmount <= 0) {
        const open = pot * fraction;
        return open < bigBlind ? bigBlind : open;
    }
    return callAmount + fraction * (callAmount + pot);
}
