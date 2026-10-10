/**
 * Read-only replay of a finished hand, from chain state alone:
 *   1. CometBFT `tx_search` for the `hand_ended` event of (gameId, N) → block height H.
 *   2. `abci_query` of GameStatePublic AT height H → the table as hand N ended: final
 *      board, pots, winners and the action log; only shown hole cards are unmasked.
 *   If hand N ended in the block where N+1 started, H shows N+1 and H-1 is tried.
 * Historical state exists only on nodes that keep it (default pruning ≈ 30 days).
 * Same approach as the web app's `?hand=N` table replay.
 */
import type { ActionDTO, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";

/** gRPC method path of the public (masked) game state query. */
export const GAME_STATE_PUBLIC_PATH = "/pokerchain.poker.v1.Query/GameStatePublic";

export function handEndedQuery(gameId: string, handNumber: number): string {
    if (!/^[A-Za-z0-9]+$/.test(gameId)) throw new Error(`Invalid table id: ${gameId}`);
    if (!Number.isInteger(handNumber) || handNumber < 1) throw new Error(`Invalid hand number: ${handNumber}`);
    return `hand_ended.game_id='${gameId}' AND hand_ended.hand_number='${handNumber}'`;
}

interface TxSearchResponse {
    result?: { txs?: Array<{ height?: string }> };
}

/** Height of the first tx in a tx_search result, or null when there is none. */
export function parseTxSearchHeight(response: unknown): number | null {
    const txs = (response as TxSearchResponse | null)?.result?.txs;
    if (!Array.isArray(txs) || txs.length === 0) return null;
    const height = Number(txs[0].height);
    return Number.isInteger(height) && height > 0 ? height : null;
}

/** Heights to try for a hand's final state: the end block, then the one before it. */
export function snapshotHeights(endHeight: number): number[] {
    return endHeight > 1 ? [endHeight, endHeight - 1] : [endHeight];
}

function encodeVarint(n: number): number[] {
    const out: number[] = [];
    let v = n;
    while (v > 0x7f) {
        out.push((v & 0x7f) | 0x80);
        v >>>= 7;
    }
    out.push(v);
    return out;
}

/** `0x`-prefixed hex of a protobuf message `{ string field1 = 1 }`, for abci_query's `data`. */
export function encodeStringField1(value: string): string {
    const bytes = new TextEncoder().encode(value);
    const all = [0x0a, ...encodeVarint(bytes.length), ...bytes];
    return "0x" + all.map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Decodes field 1 (a string) from a base64 protobuf message. */
export function decodeStringField1(base64: string): string {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    if (bytes.length === 0) return "";
    if (bytes[0] !== 0x0a) throw new Error(`Unexpected protobuf tag 0x${bytes[0].toString(16)}`);
    let i = 1;
    let len = 0;
    let shift = 0;
    for (;;) {
        if (i >= bytes.length) throw new Error("Truncated protobuf length");
        const b = bytes[i++];
        len |= (b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
    }
    if (i + len > bytes.length) throw new Error("Truncated protobuf string");
    return new TextDecoder().decode(bytes.subarray(i, i + len));
}

interface AbciQueryResponse {
    result?: { response?: { code?: number; log?: string; value?: string | null } };
}

/** The decoded string from an abci_query response; throws with the node's log on failure. */
export function parseAbciStringResponse(response: unknown): string {
    const r = (response as AbciQueryResponse | null)?.result?.response;
    if (r === undefined) throw new Error("Malformed abci_query response");
    if (r.code !== undefined && r.code !== 0) throw new Error(r.log !== undefined && r.log !== "" ? r.log : `abci_query failed with code ${r.code}`);
    if (r.value === undefined || r.value === null || r.value === "") throw new Error("abci_query returned no value");
    return decodeStringField1(r.value);
}

export interface ParsedGameState {
    state: TexasHoldemStateDTO;
    format: string | undefined;
}

/** Parses the chain's game_state JSON (nested under `gameState`, or a bare state). */
export function parseGameStateJson(json: string): ParsedGameState {
    const parsed = JSON.parse(json) as { gameState?: TexasHoldemStateDTO; format?: unknown } & Partial<TexasHoldemStateDTO>;
    const state = (parsed.gameState ?? parsed) as TexasHoldemStateDTO;
    if (typeof state.handNumber !== "number") throw new Error("Game state has no handNumber");
    return { state, format: typeof parsed.format === "string" ? parsed.format : undefined };
}

// ── Steps ──

/** Table events that aren't part of the hand's play. */
const NON_PLAY_ACTIONS = new Set(["join", "leave", "sit-in", "sit-out", "new-hand", "deal"]);

const BOARD_BY_ROUND: Record<string, number> = { ante: 0, preflop: 0, flop: 3, turn: 4, river: 5, showdown: 5, end: 5 };

export interface ReplayStep {
    /** Street label, e.g. "Flop". */
    street: string;
    action: ActionDTO | null;
    /** Community cards visible at this step. */
    board: string[];
}

function capitalise(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * One step per played action of the hand, preceded by an opening step with
 * an empty board. The board grows with the street each action happened on.
 */
export function buildReplaySteps(state: TexasHoldemStateDTO): ReplayStep[] {
    const steps: ReplayStep[] = [{ street: "Start", action: null, board: [] }];
    for (const action of state.previousActions) {
        if (NON_PLAY_ACTIONS.has(action.action)) continue;
        const visible = BOARD_BY_ROUND[action.round] ?? 0;
        steps.push({ street: action.round === "ante" ? "Blinds" : capitalise(action.round), action, board: state.communityCards.slice(0, visible) });
    }
    // Make sure the final step shows the whole board even when the last action
    // was before the river (e.g. everyone all-in earlier).
    const last = steps[steps.length - 1];
    if (last.board.length < state.communityCards.length) {
        steps.push({ street: "Showdown", action: null, board: state.communityCards });
    }
    return steps;
}
