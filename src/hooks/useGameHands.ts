import { useCallback, useEffect, useState } from "react";
import { indexerApi, type IndexedHand } from "../utils/indexer";
import type { RecentHandsState } from "./useRecentHands";

const PAGE_SIZE = 25;

/** The indexed hands of one table (newest first), paged. Idle while `gameId` is null. */
export function useGameHands(gameId: string | null): RecentHandsState {
    const [state, setState] = useState<{ gameId: string | null; hands: IndexedHand[]; total: number }>({ gameId: null, hands: [], total: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (gameId === null) return;
        const controller = new AbortController();
        setIsLoading(true);
        setError("");
        indexerApi
            .getHandsForGame(gameId, PAGE_SIZE, 0, controller.signal)
            .then(res => setState({ gameId, hands: res.data, total: res.pagination.total }))
            .catch(err => {
                if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Failed to load hands");
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false);
            });
        return () => controller.abort();
    }, [gameId]);

    const current = state.gameId === gameId && gameId !== null ? state : { gameId, hands: [], total: 0 };

    const loadMore = useCallback(() => {
        if (gameId === null || isLoading) return;
        setIsLoading(true);
        indexerApi
            .getHandsForGame(gameId, PAGE_SIZE, current.hands.length)
            .then(res => setState({ gameId, hands: [...current.hands, ...res.data], total: res.pagination.total }))
            .catch(err => setError(err instanceof Error ? err.message : "Failed to load hands"))
            .finally(() => setIsLoading(false));
    }, [gameId, isLoading, current.hands]);

    return { hands: current.hands, total: current.total, isLoading, error, hasMore: current.hands.length < current.total, loadMore };
}
