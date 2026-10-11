import { useCallback, useEffect, useState } from "react";
import { indexerApi, type IndexedHand } from "../utils/indexer";

const PAGE_SIZE = 25;

export interface RecentHandsState {
    hands: IndexedHand[];
    total: number;
    isLoading: boolean;
    error: string;
    hasMore: boolean;
    loadMore: () => void;
}

/** Most recent indexed hands across all tables, paged. */
export function useRecentHands(enabled: boolean): RecentHandsState {
    const [hands, setHands] = useState<IndexedHand[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const fetchPage = useCallback((offset: number, signal?: AbortSignal) => {
        setIsLoading(true);
        setError("");
        indexerApi
            .getRecentHands(PAGE_SIZE, offset, signal)
            .then(res => {
                setHands(prev => (offset === 0 ? res.data : [...prev, ...res.data]));
                setTotal(res.pagination.total);
            })
            .catch(err => {
                if (signal?.aborted === true) return;
                setError(err instanceof Error ? err.message : "Failed to load hands");
            })
            .finally(() => {
                if (signal?.aborted !== true) setIsLoading(false);
            });
    }, []);

    useEffect(() => {
        if (!enabled || hands.length > 0) return;
        const controller = new AbortController();
        fetchPage(0, controller.signal);
        return () => controller.abort();
        // Only the first activation fetches; later pages come from loadMore.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    const loadMore = useCallback(() => fetchPage(hands.length), [fetchPage, hands.length]);

    return { hands, total, isLoading, error, hasMore: hands.length < total, loadMore };
}
