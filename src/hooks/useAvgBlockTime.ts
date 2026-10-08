import { useState, useEffect, useCallback } from "react";
import { getCosmosClient } from "../utils/cosmos/client";
import { useNetwork } from "../context/NetworkContext";

const POLL_INTERVAL_MS = 15000;
const BLOCK_SAMPLE_SIZE = 5;

/**
 * Averages the gaps between consecutive block timestamps (newest-first, as
 * getLatestBlocks returns them). Needs at least 2 timestamps to produce a
 * delta; returns null otherwise.
 */
export function computeAvgBlockTimeSeconds(blockTimesNewestFirst: string[]): number | null {
    if (blockTimesNewestFirst.length < 2) return null;

    const deltas: number[] = [];
    for (let i = 0; i < blockTimesNewestFirst.length - 1; i++) {
        const newer = new Date(blockTimesNewestFirst[i]).getTime();
        const older = new Date(blockTimesNewestFirst[i + 1]).getTime();
        deltas.push((newer - older) / 1000);
    }

    return deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
}

export interface UseAvgBlockTimeReturn {
    avgBlockTimeSeconds: number | null;
    isLoading: boolean;
}

export function useAvgBlockTime(): UseAvgBlockTimeReturn {
    const { currentNetwork } = useNetwork();
    const [avgBlockTimeSeconds, setAvgBlockTimeSeconds] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchAvgBlockTime = useCallback(async () => {
        try {
            const cosmosClient = getCosmosClient({
                rpc: currentNetwork.rpc,
                rest: currentNetwork.rest,
            });
            if (!cosmosClient) return;

            const blocks = await cosmosClient.getLatestBlocks(BLOCK_SAMPLE_SIZE);
            const times = blocks.map(b => b.block.header.time);
            setAvgBlockTimeSeconds(computeAvgBlockTimeSeconds(times));
        } catch {
            setAvgBlockTimeSeconds(null);
        } finally {
            setIsLoading(false);
        }
    }, [currentNetwork]);

    useEffect(() => {
        fetchAvgBlockTime();
        const interval = setInterval(fetchAvgBlockTime, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [fetchAvgBlockTime]);

    return { avgBlockTimeSeconds, isLoading };
}
