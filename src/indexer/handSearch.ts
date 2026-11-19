import type { IndexedHand } from "../utils/indexer";

/** What the page gets back from a hand search. `available` is false when this build has no indexer API key. */
export type HandSearchResult = { available: false } | { available: true; hands: IndexedHand[]; total: number };

const MAX_QUERY_CHARS = 100;
const MAX_LIMIT = 100;
// Table ids (0x… with an optional -t<N> suffix) and b52 addresses are letters, digits and dashes.
const SEARCHABLE = /^[A-Za-z0-9-]+$/;

/**
 * Hands whose table id or one of whose players' addresses contains the text, newest first, with the total for
 * paging. The text only ever reaches the query as a variable.
 */
export const HAND_SEARCH_QUERY = `query HandSearch($where: poker_hands_bool_exp, $limit: Int, $offset: Int) {
  poker_hands(where: $where, order_by: [{block_height: desc}], limit: $limit, offset: $offset) {
    game_id
    hand_number
    block_height
    deck_seed
    indexed_at
  }
  total: poker_hands_aggregate(where: $where) { aggregate { count } }
}`;

/** The request body for a search, or an error the user can act on. */
export function buildHandSearch(text: unknown, limit: unknown, offset: unknown): { query: string; variables: Record<string, unknown> } {
    if (typeof text !== "string") throw new Error("Search by a table id or a player address.");
    const trimmed = text.trim();
    if (trimmed === "" || trimmed.length > MAX_QUERY_CHARS || !SEARCHABLE.test(trimmed)) {
        throw new Error("Search by a table id or a player address.");
    }
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new Error("Invalid page size.");
    if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0) throw new Error("Invalid page.");
    // SEARCHABLE already rules out % and _, so the text cannot widen the match.
    const pattern = `%${trimmed}%`;
    return {
        query: HAND_SEARCH_QUERY,
        variables: {
            where: { _or: [{ game_id: { _ilike: pattern } }, { players: { player_address: { _ilike: pattern } } }] },
            limit,
            offset,
        },
    };
}

interface SearchRow {
    game_id: string;
    hand_number: number;
    block_height: number;
    deck_seed: string;
    indexed_at: string;
}

function isRow(value: unknown): value is SearchRow {
    if (typeof value !== "object" || value === null) return false;
    const row = value as Record<string, unknown>;
    return (
        typeof row.game_id === "string" &&
        typeof row.hand_number === "number" &&
        typeof row.block_height === "number" &&
        typeof row.deck_seed === "string" &&
        typeof row.indexed_at === "string"
    );
}

/** Reads a GraphQL response. Errors from the indexer (a timeout, an unknown field) become an Error with its message. */
export function parseHandSearch(body: unknown): { hands: IndexedHand[]; total: number } {
    const response = (typeof body === "object" && body !== null ? body : {}) as { data?: unknown; errors?: unknown };
    if (Array.isArray(response.errors) && response.errors.length > 0) {
        const first = response.errors[0] as { message?: unknown };
        throw new Error(`Indexer search failed: ${typeof first.message === "string" ? first.message : "unknown error"}`);
    }
    const data = (response.data ?? {}) as { poker_hands?: unknown; total?: { aggregate?: { count?: unknown } } };
    const rows = Array.isArray(data.poker_hands) ? data.poker_hands : null;
    const total = data.total?.aggregate?.count;
    if (rows === null || !rows.every(isRow) || typeof total !== "number") throw new Error("Indexer search returned an unexpected response.");
    // The api views have indexed_at rather than created_at; the list shows it as the hand's time.
    const hands = rows.map(row => ({
        game_id: row.game_id,
        hand_number: row.hand_number,
        block_height: row.block_height,
        deck_seed: row.deck_seed,
        created_at: row.indexed_at,
    }));
    return { hands, total };
}

/** A readable message for an HTTP failure from POST /graphql. */
export function describeHttpFailure(status: number): string {
    if (status === 401 || status === 403) return "Indexer search refused this build's API key.";
    if (status === 429) return "Indexer search is busy (rate limit). Try again in a moment.";
    return `Indexer search failed (HTTP ${status}).`;
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
}>;

const REQUEST_TIMEOUT_MS = 15_000;

/** Runs one hand search against the indexer's GraphQL endpoint with the API key. */
export async function searchHands(
    options: { indexerUrl: string; apiKey: string; fetch: Fetch },
    text: unknown,
    limit: unknown,
    offset: unknown,
): Promise<{ hands: IndexedHand[]; total: number }> {
    const body = JSON.stringify(buildHandSearch(text, limit, offset));
    const response = await options.fetch(`${options.indexerUrl.replace(/\/+$/, "")}/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${options.apiKey}` },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(describeHttpFailure(response.status));
    return parseHandSearch(await response.json());
}
