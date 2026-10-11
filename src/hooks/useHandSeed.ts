import { useEffect, useState } from "react";
import { indexerApi } from "../utils/indexer";

/**
 * The deck seed the chain recorded for a hand (via the indexer), or null while the hand has no
 * recorded seed yet. Re-checks every few seconds until it appears, then stops.
 */
export function useHandSeed(gameId: string | null, handNumber: number | null): string | null {
    const [found, setFound] = useState<{ key: string; seed: string } | null>(null);
    const key = gameId !== null && handNumber !== null && handNumber > 0 ? `${gameId}:${handNumber}` : null;

    useEffect(() => {
        if (key === null || gameId === null || handNumber === null) return;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;

        const check = () => {
            indexerApi
                .getHand(gameId, handNumber, controller.signal)
                .then(hand => {
                    if (hand.deck_seed !== "") {
                        setFound({ key, seed: hand.deck_seed });
                    } else {
                        timer = setTimeout(check, 4000);
                    }
                })
                .catch(() => {
                    if (!controller.signal.aborted) timer = setTimeout(check, 4000);
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
