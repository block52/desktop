/** Create-table options, mirrored from the web app (ui/src/constants/blindLevels.ts, utils/buyInUtils.ts). */

export interface BlindLevel {
    label: string;
    /** Decimal USDC, kept as text so micro conversion stays exact. */
    smallBlind: string;
    bigBlind: string;
}

export const BLIND_LEVELS: ReadonlyArray<BlindLevel> = [
    { label: "0.01 / 0.02", smallBlind: "0.01", bigBlind: "0.02" },
    { label: "0.02 / 0.05", smallBlind: "0.02", bigBlind: "0.05" },
    { label: "0.05 / 0.10", smallBlind: "0.05", bigBlind: "0.1" },
    { label: "0.10 / 0.25", smallBlind: "0.1", bigBlind: "0.25" },
    { label: "0.25 / 0.50", smallBlind: "0.25", bigBlind: "0.5" },
    { label: "0.50 / 1.00", smallBlind: "0.5", bigBlind: "1" },
    { label: "1.00 / 2.00", smallBlind: "1", bigBlind: "2" },
    { label: "2.50 / 5.00", smallBlind: "2.5", bigBlind: "5" },
    { label: "5.00 / 10.00", smallBlind: "5", bigBlind: "10" },
    { label: "10.00 / 20.00", smallBlind: "10", bigBlind: "20" },
    { label: "25.00 / 50.00", smallBlind: "25", bigBlind: "50" },
    { label: "50.00 / 100.00", smallBlind: "50", bigBlind: "100" },
    { label: "100.00 / 200.00", smallBlind: "100", bigBlind: "200" },
    { label: "200.00 / 400.00", smallBlind: "200", bigBlind: "400" },
    { label: "300.00 / 600.00", smallBlind: "300", bigBlind: "600" },
    { label: "500.00 / 1,000.00", smallBlind: "500", bigBlind: "1000" },
    { label: "1,000.00 / 2,000.00", smallBlind: "1000", bigBlind: "2000" },
    { label: "2,000.00 / 4,000.00", smallBlind: "2000", bigBlind: "4000" },
    { label: "5,000.00 / 10,000.00", smallBlind: "5000", bigBlind: "10000" },
    { label: "10,000.00 / 20,000.00", smallBlind: "10000", bigBlind: "20000" },
    { label: "20,000.00 / 40,000.00", smallBlind: "20000", bigBlind: "40000" },
    { label: "25,000.00 / 50,000.00", smallBlind: "25000", bigBlind: "50000" }
];

export const DEFAULT_BLIND_LEVEL_INDEX = 0;

/** Sit & Go blinds are chip counts, not dollars. */
export const SNG_BLINDS: ReadonlyArray<{ smallBlind: number; bigBlind: number }> = [
    { smallBlind: 10, bigBlind: 20 },
    { smallBlind: 25, bigBlind: 50 },
    { smallBlind: 50, bigBlind: 100 }
];

export const SNG_STARTING_STACKS: ReadonlyArray<{ label: string; chips: number }> = [
    { label: "Turbo (1,000)", chips: 1000 },
    { label: "Standard (1,500)", chips: 1500 },
    { label: "Deep Stack (3,000)", chips: 3000 }
];

export const SNG_BLIND_DURATIONS: ReadonlyArray<{ label: string; minutes: number }> = [
    { label: "Hyper (3 min)", minutes: 3 },
    { label: "Turbo (5 min)", minutes: 5 },
    { label: "Standard (10 min)", minutes: 10 },
    { label: "Deep (15 min)", minutes: 15 }
];

export const BUY_IN_PRESETS: ReadonlyArray<{ label: string; minBB: number; maxBB: number }> = [
    { label: "Standard (20-100 BB)", minBB: 20, maxBB: 100 },
    { label: "Deep (40-200 BB)", minBB: 40, maxBB: 200 },
    { label: "Deep Stack (100-300 BB)", minBB: 100, maxBB: 300 }
];

export const MIN_BUY_IN_BB = 20;
export const MAX_BUY_IN_BB = 500;

export function validateBuyInBB(minBB: number, maxBB: number): string | null {
    if (!Number.isInteger(minBB) || !Number.isInteger(maxBB)) return "Buy-in must be a whole number of big blinds";
    if (minBB < MIN_BUY_IN_BB) return `Minimum buy-in must be at least ${MIN_BUY_IN_BB} BB`;
    if (maxBB > MAX_BUY_IN_BB) return `Maximum buy-in cannot exceed ${MAX_BUY_IN_BB} BB`;
    if (minBB >= maxBB) return "Minimum buy-in must be less than maximum buy-in";
    return null;
}
