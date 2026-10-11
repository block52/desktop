import { indexerApi, type PlayerHand } from "./indexer";
import { handsInSession } from "./sessionHands";

export interface WalletHandsPage {
    data: PlayerHand[];
    total: number;
    /** True when the hands were matched from table sessions because the indexer had none attributed. */
    estimated: boolean;
}

const MAX_SESSIONS = 20;
const HANDS_PER_TABLE = 200;
const CACHE_MS = 30_000;
const sessionHandsCache = new Map<string, { at: number; hands: PlayerHand[] }>();

async function handsFromSessions(address: string, signal?: AbortSignal): Promise<PlayerHand[]> {
    const cached = sessionHandsCache.get(address);
    if (cached !== undefined && Date.now() - cached.at < CACHE_MS) return cached.hands;

    const sessions = await indexerApi.getPlayerSessions(address, MAX_SESSIONS, 0, signal);
    const perSession = await Promise.all(
        sessions.data.map(async session => {
            const tableHands = await indexerApi.getHandsForGame(session.game_id, HANDS_PER_TABLE, 0, signal);
            return handsInSession(session, tableHands.data);
        })
    );
    const hands = perSession.flat().sort((a, b) => b.block_height - a.block_height);
    sessionHandsCache.set(address, { at: Date.now(), hands });
    return hands;
}

/**
 * A page of the finished hands a wallet played. Prefers the indexer's own per-player hands; when it has
 * none attributed (it indexes hands and sessions but may not link them to players), falls back to the hands
 * of every table the wallet sat at, while it was seated.
 */
export async function fetchWalletHands(address: string, limit: number, offset: number, signal?: AbortSignal): Promise<WalletHandsPage> {
    const direct = await indexerApi.getPlayerHands(address, limit, offset, signal);
    if (direct.pagination.total > 0) {
        return { data: direct.data, total: direct.pagination.total, estimated: false };
    }
    const all = await handsFromSessions(address, signal);
    return { data: all.slice(offset, offset + limit), total: all.length, estimated: true };
}
