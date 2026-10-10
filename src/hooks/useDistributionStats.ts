import { useCallback, useEffect, useState } from "react";
import { indexerApi, type CardStats, type IndexerStatus, type RandomnessReport, type StatsSummary } from "../utils/indexer";

export interface DistributionStats {
    cards: CardStats[];
    summary: StatsSummary | null;
    randomness: RandomnessReport | null;
    status: IndexerStatus | null;
    isLoading: boolean;
    /** Set only when the primary card-stats request fails; the other three are supplementary. */
    error: string | null;
    reload: () => void;
}

export function useDistributionStats(): DistributionStats {
    const [cards, setCards] = useState<CardStats[]>([]);
    const [summary, setSummary] = useState<StatsSummary | null>(null);
    const [randomness, setRandomness] = useState<RandomnessReport | null>(null);
    const [status, setStatus] = useState<IndexerStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;

        void (async () => {
            setIsLoading(true);
            setError(null);
            const [cardsResult, summaryResult, randomnessResult, statusResult] = await Promise.allSettled([
                indexerApi.getCardStats(signal),
                indexerApi.getSummary(signal),
                indexerApi.getRandomness(signal),
                indexerApi.getStatus(signal),
            ]);
            if (signal.aborted) return;

            if (cardsResult.status === "fulfilled") {
                setCards(cardsResult.value);
            } else {
                setCards([]);
                setError("Unable to load distribution data from the indexer. Please try again later.");
            }
            setSummary(summaryResult.status === "fulfilled" ? summaryResult.value : null);
            setRandomness(randomnessResult.status === "fulfilled" ? randomnessResult.value : null);
            setStatus(statusResult.status === "fulfilled" ? statusResult.value : null);
            setIsLoading(false);
        })();

        return () => controller.abort();
    }, [reloadKey]);

    const reload = useCallback(() => setReloadKey(k => k + 1), []);

    return { cards, summary, randomness, status, isLoading, error, reload };
}
