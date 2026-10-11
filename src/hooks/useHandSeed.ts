import { useEffect, useState } from "react";
import { indexerApi } from "../utils/indexer";

const RETRY_DELAYS_MS = [2000, 4000, 8000, 15000, 30000];

/**
 * The deck seed recorded for a hand (via the indexer), or null while it has none yet. Re-checks with
 * a growing delay a handful of times, then gives up until the hand number changes.
 */
export function useHandSeed(gameId: string | null, handNumber: number | null): string | null {
    const [found, setFound] = useState<{ key: string; seed: string } | null>(null);
    const key = gameId !== null && handNumber !== null && handNumber > 0 ? `${gameId}:${handNumber}` : null;

    useEffect(() => {
        if (key === null || gameId === null || handNumber === null) return;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        let attempt = 0;

        const retryLater = () => {
            const delay = RETRY_DELAYS_MS[attempt];
            attempt += 1;
            if (delay !== undefined) timer = setTimeout(check, delay);
        };

        const check = () => {
            indexerApi
                .getHand(gameId, handNumber, controller.signal)
                .then(hand => {
                    if (hand.deck_seed !== "") {
                        setFound({ key, seed: hand.deck_seed });
                    } else {
                        retryLater();
                    }
                })
                .catch(() => {
                    if (!controller.signal.aborted) retryLater();
                });
        };
        check();

        return () => {
            controller.abort();
            if (timer !== undefined) clearTimeout(timer);
        };
    }, [key, gameId, handNumber]);

    return found !== null && found.key === key ? found.seed : null;
}
