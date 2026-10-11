import { useEffect, useState } from "react";
import { useNetwork } from "../context/NetworkContext";
import { indexerApi } from "../utils/indexer";
import { summariseSession, type LastSessionSummary } from "../utils/lastSession";
import { handsInSession } from "../utils/sessionHands";

interface LastSessionState {
    session: LastSessionSummary | null;
    isLoading: boolean;
    error: string;
}

/** The wallet's most recent table session from the indexer (net result, hands played, table, when). */
export function useLastSession(address: string | null): LastSessionState {
    const { currentNetwork } = useNetwork();
    const [state, setState] = useState<LastSessionState>({ session: null, isLoading: address !== null, error: "" });

    useEffect(() => {
        if (address === null) return;
        const controller = new AbortController();
        void (async () => {
            try {
                const sessions = await indexerApi.getPlayerSessions(address, 1, 0, controller.signal);
                const latest = sessions.data[0];
                if (latest === undefined) {
                    setState({ session: null, isLoading: false, error: "" });
                    return;
                }
                let handCount: number | null = null;
                try {
                    const tableHands = await indexerApi.getHandsForGame(latest.game_id, 200, 0, controller.signal);
                    handCount = handsInSession(latest, tableHands.data).length;
                } catch {
                    // The card still shows the session without a hand count.
                }
                setState({ session: summariseSession(latest, handCount, Date.now()), isLoading: false, error: "" });
            } catch (err) {
                if (!controller.signal.aborted) {
                    setState({ session: null, isLoading: false, error: err instanceof Error ? err.message : "Failed to load session" });
                }
            }
        })();
        return () => controller.abort();
    }, [address, currentNetwork]);

    return address === null ? { session: null, isLoading: false, error: "" } : state;
}
