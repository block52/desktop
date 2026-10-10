import { useEffect, useState } from "react";
import { indexerApi, type PlayerProfile, type PlayerSession } from "../utils/indexer";

const SESSION_LIMIT = 20;

export interface PlayerProfileState {
    profile: PlayerProfile | null;
    sessions: PlayerSession[];
    sessionsTotal: number;
    isLoading: boolean;
    error: string;
}

/** Stats and recent sessions for one player, from the indexer. */
export function usePlayerProfile(address: string): PlayerProfileState {
    const [state, setState] = useState<PlayerProfileState>({
        profile: null,
        sessions: [],
        sessionsTotal: 0,
        isLoading: true,
        error: ""
    });

    useEffect(() => {
        const controller = new AbortController();
        setState({ profile: null, sessions: [], sessionsTotal: 0, isLoading: true, error: "" });
        Promise.all([
            indexerApi.getPlayerProfile(address, controller.signal),
            indexerApi.getPlayerSessions(address, SESSION_LIMIT, 0, controller.signal)
        ])
            .then(([profile, sessions]) => {
                setState({ profile, sessions: sessions.data, sessionsTotal: sessions.pagination.total, isLoading: false, error: "" });
            })
            .catch(err => {
                if (controller.signal.aborted) return;
                setState({
                    profile: null,
                    sessions: [],
                    sessionsTotal: 0,
                    isLoading: false,
                    error: err instanceof Error ? err.message : "Failed to load player"
                });
            });
        return () => controller.abort();
    }, [address]);

    return state;
}
