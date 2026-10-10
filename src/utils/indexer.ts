/**
 * Block52 indexer REST API — the same service the web explorer's
 * /explorer/distribution page reads. Types mirror its JSON responses.
 */
const DEFAULT_INDEXER_URL = "https://indexer.block52.xyz";

export function getIndexerUrl(): string {
    const configured: unknown = import.meta.env.VITE_INDEXER_URL;
    return typeof configured === "string" && configured !== "" ? configured : DEFAULT_INDEXER_URL;
}

// GET /api/v1/stats/cards
export interface CardStats {
    /** "2h", "As", … */
    card: string;
    rank: string;
    suit: string;
    total_appearances: number;
    expected_frequency: number;
    actual_frequency: number;
    deviation: number;
    deviation_percent: number;
}

// GET /api/v1/stats/summary
export interface StatsSummary {
    total_hands: number;
    total_completed_hands: number;
    total_revealed_cards: number;
    unique_games: number;
}

export interface ChiSquaredResult {
    chi_squared: number;
    degrees_of_freedom: number;
    p_value: number;
    /** "PASS" | "MARGINAL" | "FAIL" | "NO_DATA" */
    result: string;
    interpretation: string;
}

// GET /api/v1/analysis/randomness
export interface RandomnessReport {
    summary: StatsSummary;
    card_chi_squared: ChiSquaredResult;
    suit_chi_squared: ChiSquaredResult;
    rank_chi_squared: ChiSquaredResult;
    outlier_cards: CardStats[] | null;
    duplicate_seeds: number;
}

// GET /api/v1/status
export interface IndexerStatus {
    total_blocks: number;
    blocks_indexed: number;
    percent_complete: number;
    last_block_indexed: number;
    first_block_indexed: number;
    total_hands: number;
    total_games: number;
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(`${getIndexerUrl()}${path}`, { signal });
    if (!response.ok) {
        throw new Error(`Indexer ${path} responded ${response.status}`);
    }
    return (await response.json()) as T;
}

export const indexerApi = {
    getCardStats: (signal?: AbortSignal) => getJson<CardStats[]>("/api/v1/stats/cards", signal),
    getSummary: (signal?: AbortSignal) => getJson<StatsSummary>("/api/v1/stats/summary", signal),
    getRandomness: (signal?: AbortSignal) => getJson<RandomnessReport>("/api/v1/analysis/randomness", signal),
    getStatus: (signal?: AbortSignal) => getJson<IndexerStatus>("/api/v1/status", signal),
};

// ── Presentation helpers ──

const SUIT_ORDER = ["c", "d", "h", "s"];
const RANK_ORDER = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "10", "J", "Q", "K", "A"];

export const SUIT_LABELS: Record<string, string> = { c: "Clubs", d: "Diamonds", h: "Hearts", s: "Spades" };

/** Suit-major (clubs, diamonds, hearts, spades), rank 2..A inside each suit — the mock's bar order. */
export function orderCardStats(stats: CardStats[]): CardStats[] {
    return [...stats].sort((a, b) => {
        const suitDiff = SUIT_ORDER.indexOf(a.suit.toLowerCase()) - SUIT_ORDER.indexOf(b.suit.toLowerCase());
        if (suitDiff !== 0) return suitDiff;
        return RANK_ORDER.indexOf(a.rank.toUpperCase()) - RANK_ORDER.indexOf(b.rank.toUpperCase());
    });
}

export type ResultTone = "ok" | "warn" | "bad" | "mute";

export interface ResultPresentation {
    label: string;
    tone: ResultTone;
}

/** Maps the indexer's result string to a verdict label + tone. Unknown strings are shown verbatim, muted. */
export function presentResult(result: string): ResultPresentation {
    switch (result) {
        case "PASS":
            return { label: "Consistent with fair", tone: "ok" };
        case "MARGINAL":
            return { label: "Borderline", tone: "warn" };
        case "FAIL":
            return { label: "Unlikely fair", tone: "bad" };
        case "NO_DATA":
            return { label: "No data yet", tone: "mute" };
        default:
            return { label: result, tone: "mute" };
    }
}
