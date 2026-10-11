import { useCallback, useEffect, useState } from "react";
import { useNetwork } from "../context/NetworkContext";
import { indexerApi, type PlayerHand } from "../utils/indexer";
import { useChipTables } from "./useMyHands";

export interface MyHandsPageState {
    hands: PlayerHand[];
    total: number;
    isLoading: boolean;
    error: string;
    reload: () => void;
    /** true = chips (Sit & Go / tournament), false = micro-USDC; absent while unknown. */
    chipTables: Map<string, boolean>;
}

/** One page of the finished hands a wallet played (newest first), fetched by offset. */
export function useMyHandsPage(address: string | null, page: number, pageSize: number): MyHandsPageState {
    const { currentNetwork } = useNetwork();
    const [hands, setHands] = useState<PlayerHand[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [nonce, setNonce] = useState(0);

    useEffect(() => {
        setError("");
        if (address === null) {
            setHands([]);
            setTotal(0);
            return;
        }
        const controller = new AbortController();
        setIsLoading(true);
        indexerApi
            .getPlayerHands(address, pageSize, (page - 1) * pageSize, controller.signal)
            .then(res => {
                setHands(res.data);
                setTotal(res.pagination.total);
            })
            .catch(err => {
                if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Failed to load hands");
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false);
            });
        return () => controller.abort();
    }, [address, currentNetwork, nonce, page, pageSize]);

    const chipTables = useChipTables(hands);
    const reload = useCallback(() => setNonce(n => n + 1), []);

    return { hands, total, isLoading, error, reload, chipTables };
}
