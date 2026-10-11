import { useCallback, useEffect, useState } from "react";
import { indexerApi, type PlayerListItem, type PlayerSearchParams } from "../utils/indexer";

export interface PlayersDirectoryState {
    players: PlayerListItem[];
    total: number;
    isLoading: boolean;
    error: string;
    reload: () => void;
}

/** One page of the indexer's player directory; refetches when the params change. */
export function usePlayersDirectory(params: PlayerSearchParams): PlayersDirectoryState {
    const { search, sort, order, limit, offset } = params;
    const [players, setPlayers] = useState<PlayerListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [nonce, setNonce] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setIsLoading(true);
        setError("");
        indexerApi
            .getPlayers({ search, sort, order, limit, offset }, controller.signal)
            .then(res => {
                setPlayers(res.data);
                setTotal(res.pagination.total);
            })
            .catch(err => {
                if (controller.signal.aborted) return;
                setPlayers([]);
                setTotal(0);
                setError(err instanceof Error ? err.message : "Failed to load players");
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false);
            });
        return () => controller.abort();
    }, [search, sort, order, limit, offset, nonce]);

    const reload = useCallback(() => setNonce(n => n + 1), []);

    return { players, total, isLoading, error, reload };
}
