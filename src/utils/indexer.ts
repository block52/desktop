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

// GET /api/v1/players — money fields are micro-USDC.
export type PlayerSortField = "net_profit" | "total_hands" | "total_rake_contributed" | "vip_points" | "last_seen_block";

export interface PlayerListItem {
    player_address: string;
    vip_tier: string;
    rakeback_pct: number;
    total_hands: number;
    total_actions: number;
    net_profit: number;
    total_rake_contributed: number;
    last_seen_block?: number;
}

export interface PlayerSearchParams {
    search: string;
    sort: PlayerSortField;
    order: "asc" | "desc";
    limit: number;
    offset: number;
}

// GET /api/v1/players/:address/hands — amounts are in the table's units
// (chips for Sit & Go / tournament, micro-USDC for cash).
export interface PlayerHand {
    game_id: string;
    hand_number: number;
    seat: number;
    /** The player's status at the hand's end ("" if they have since left). */
    status: string;
    won_amount: number;
    block_height: number;
    ended_at?: string;
    community_cards: string[];
    winner_count: number;
}

// GET /api/v1/players/:address/stats — money is micro-USDC; percentage fields
// (vpip, pfr, aggression_factor, wtsd, won_at_showdown) are integers scaled x100.
export interface PlayerProfile {
    player_address: string;
    total_hands: number;
    total_actions: number;
    total_buy_ins: number;
    total_cash_outs: number;
    net_profit: number;
    session_count: number;
    vip_tier: string;
    rakeback_pct: number;
    vip_points: number;
    total_rake_contributed: number;
    vpip: number;
    pfr: number;
    aggression_factor: number;
    wtsd: number;
    won_at_showdown: number;
    biggest_pot_won: number;
    biggest_hand_profit: number;
    longest_session_blocks: number;
    first_seen_block?: number;
    last_seen_block?: number;
}

// GET /api/v1/players/:address/sessions
export interface PlayerSession {
    player_address: string;
    game_id: string;
    join_block: number;
    leave_block?: number;
    buy_in_amount: number;
    cash_out_amount?: number;
    created_at: string;
}

// GET /api/v1/hands — one row per indexed hand.
export interface IndexedHand {
    game_id: string;
    hand_number: number;
    block_height: number;
    deck_seed: string;
    created_at: string;
}

export interface Paged<T> {
    data: T[];
    pagination: { limit: number; offset: number; total: number };
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
    getPlayers: (params: PlayerSearchParams, signal?: AbortSignal) => {
        const query = new URLSearchParams({
            sort: params.sort,
            order: params.order,
            limit: String(params.limit),
            offset: String(params.offset)
        });
        if (params.search !== "") query.set("search", params.search);
        return getJson<Paged<PlayerListItem>>(`/api/v1/players?${query.toString()}`, signal);
    },
    getRecentHands: (limit: number, offset: number, signal?: AbortSignal) =>
        getJson<Paged<IndexedHand>>(`/api/v1/hands?limit=${limit}&offset=${offset}`, signal),
    getHand: (gameId: string, handNumber: number, signal?: AbortSignal) =>
        getJson<IndexedHand>(`/api/v1/hands/${encodeURIComponent(gameId)}/${handNumber}`, signal),
    getPlayerProfile: (address: string, signal?: AbortSignal) =>
        getJson<PlayerProfile>(`/api/v1/players/${encodeURIComponent(address)}/stats`, signal),
    getPlayerSessions: (address: string, limit: number, offset: number, signal?: AbortSignal) =>
        getJson<Paged<PlayerSession>>(`/api/v1/players/${encodeURIComponent(address)}/sessions?limit=${limit}&offset=${offset}`, signal),
    getPlayerHands: (address: string, limit: number, offset: number, signal?: AbortSignal) =>
        getJson<Paged<PlayerHand>>(`/api/v1/players/${encodeURIComponent(address)}/hands?limit=${limit}&offset=${offset}`, signal),
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
