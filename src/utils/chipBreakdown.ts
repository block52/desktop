/**
 * Poker chip denominations (the web app's chip set) and a greedy decomposition of an
 * amount into chip stacks. Amounts are whole dollars/chips — sub-dollar bets floor to
 * a single white chip.
 */

export interface ChipDenomination {
    value: number;
    file: string;
}

const CHIP_DENOMINATIONS: ChipDenomination[] = [
    { value: 5_000_000, file: "5000000chip" },
    { value: 1_000_000, file: "1000000chip" },
    { value: 250_000, file: "250000chip" },
    { value: 100_000, file: "100000chip" },
    { value: 25_000, file: "25000chip" },
    { value: 5_000, file: "5000chip" },
    { value: 1_000, file: "1000chip" },
    { value: 500, file: "500chip" },
    { value: 100, file: "100chip" },
    { value: 25, file: "25chip" },
    { value: 5, file: "5chip" },
    { value: 1, file: "1chip" }
];

export interface ChipStack {
    value: number;
    file: string;
    /** True number of chips of this denomination. */
    count: number;
    /** Chips actually drawn in the pile (capped so the pile stays compact). */
    visibleCount: number;
}

export const MAX_STACKS = 4;
export const MAX_CHIPS_PER_STACK = 5;

/** Decompose an amount into at most MAX_STACKS denomination piles, largest first. */
export function decomposeAmount(amount: number): ChipStack[] {
    let remainder = Math.floor(amount);
    if (!Number.isFinite(remainder) || remainder <= 0) {
        return [{ value: 1, file: "1chip", count: 1, visibleCount: 1 }];
    }

    const stacks: ChipStack[] = [];
    for (const denom of CHIP_DENOMINATIONS) {
        if (remainder < denom.value) continue;
        const count = Math.floor(remainder / denom.value);
        stacks.push({ value: denom.value, file: denom.file, count, visibleCount: Math.min(count, MAX_CHIPS_PER_STACK) });
        remainder -= count * denom.value;
        if (remainder === 0) break;
    }

    if (stacks.length > MAX_STACKS) {
        const dropped = stacks.splice(MAX_STACKS);
        const droppedValue = dropped.reduce((sum, s) => sum + s.value * s.count, 0);
        const last = stacks[stacks.length - 1];
        last.count += Math.floor(droppedValue / last.value);
        last.visibleCount = Math.min(last.count, MAX_CHIPS_PER_STACK);
    }
    return stacks;
}
