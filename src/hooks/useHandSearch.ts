import { useCallback, useEffect, useRef, useState } from "react";
import type { IndexedHand } from "../utils/indexer";
import type { RecentHandsState } from "./useRecentHands";

const PAGE_SIZE = 25;

/** Electron prefixes errors that cross IPC with "Error invoking remote method '…': Error: ". Show only the reason. */
function ipcMessage(err: unknown, fallback: string): string {
    const message = err instanceof Error ? err.message : fallback;
    return message.replace(/^Error invoking remote method '[^']*': (Error: )?/, "");
}

/** Whether this build can search the indexer (it has an API key). False outside the desktop app. */
export function useHandSearchAvailable(): boolean {
    const [available, setAvailable] = useState(false);
    useEffect(() => {
        const indexer = window.electronAPI?.indexer;
        if (indexer === undefined) return;
        let cancelled = false;
        indexer
            .isSearchAvailable()
            .then(value => {
                if (!cancelled) setAvailable(value);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);
    return available;
}

/** Hands matching a table id or player address through the indexer's GraphQL API, paged. Idle while `text` is null. */
export function useHandSearch(text: string | null): RecentHandsState {
    const [state, setState] = useState<{ text: string | null; hands: IndexedHand[]; total: number }>({ text: null, hands: [], total: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    // Only the newest request may update the list, so a slow earlier search cannot overwrite a later one.
    const latest = useRef(0);

    const run = useCallback(async (query: string, offset: number, previous: IndexedHand[]) => {
        const indexer = window.electronAPI?.indexer;
        if (indexer === undefined) {
            setError("Search is only available in the desktop app.");
            return;
        }
        const request = ++latest.current;
        setIsLoading(true);
        setError("");
        try {
            const result = await indexer.searchHands(query, PAGE_SIZE, offset);
            if (request !== latest.current) return;
            if (!result.available) {
                setError("Search needs the indexer API key, which this build does not have.");
                setState({ text: query, hands: [], total: 0 });
                return;
            }
            setState({ text: query, hands: [...previous, ...result.hands], total: result.total });
        } catch (err) {
            if (request === latest.current) setError(ipcMessage(err, "Search failed."));
        } finally {
            if (request === latest.current) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (text === null) {
            latest.current++;
            setIsLoading(false);
            setError("");
            return;
        }
        void run(text, 0, []);
    }, [text, run]);

    const current = state.text === text && text !== null ? state : { text, hands: [], total: 0 };

    const loadMore = useCallback(() => {
        if (text === null || isLoading) return;
        void run(text, current.hands.length, current.hands);
    }, [text, isLoading, run, current.hands]);

    return {
        hands: current.hands,
        total: current.total,
        isLoading,
        error: text === null ? "" : error,
        hasMore: current.hands.length < current.total,
        loadMore,
    };
}
