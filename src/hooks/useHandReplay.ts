import { useEffect, useState } from "react";
import { useNetwork } from "../context/NetworkContext";
import {
    GAME_STATE_PUBLIC_PATH,
    encodeStringField1,
    handEndedQuery,
    parseAbciStringResponse,
    parseGameStateJson,
    parseTxSearchHeight,
    snapshotHeights,
    type ParsedGameState
} from "../utils/handReplay";
import { indexerApi } from "../utils/indexer";

export interface HandReplayState {
    snapshot: ParsedGameState | null;
    deckSeed: string | null;
    isLoading: boolean;
    error: string;
}

async function rpcGet(rpc: string, path: string, signal: AbortSignal): Promise<unknown> {
    const response = await fetch(`${rpc.replace(/\/+$/, "")}/${path}`, { signal });
    if (!response.ok) throw new Error(`Node responded ${response.status}`);
    return response.json();
}

/** Final chain state of one finished hand (plus its deck seed from the indexer). */
export function useHandReplay(gameId: string | null, handNumber: number | null): HandReplayState {
    const { currentNetwork } = useNetwork();
    const [state, setState] = useState<HandReplayState>({ snapshot: null, deckSeed: null, isLoading: false, error: "" });

    useEffect(() => {
        if (gameId === null || handNumber === null) {
            setState({ snapshot: null, deckSeed: null, isLoading: false, error: "" });
            return;
        }
        const controller = new AbortController();
        const { signal } = controller;
        setState({ snapshot: null, deckSeed: null, isLoading: true, error: "" });

        const load = async () => {
            const rpc = currentNetwork.rpc;
            const query = encodeURIComponent(`"${handEndedQuery(gameId, handNumber)}"`);
            const search = await rpcGet(rpc, `tx_search?query=${query}&per_page=1&order_by=${encodeURIComponent("\"desc\"")}`, signal);
            const endHeight = parseTxSearchHeight(search);
            if (endHeight === null) {
                throw new Error(`Hand #${handNumber} isn't recorded on ${currentNetwork.name}.`);
            }
            const data = encodeStringField1(gameId);
            for (const height of snapshotHeights(endHeight)) {
                try {
                    const path = `abci_query?path=${encodeURIComponent(`"${GAME_STATE_PUBLIC_PATH}"`)}&data=${data}&height=${height}`;
                    const snapshot = parseGameStateJson(parseAbciStringResponse(await rpcGet(rpc, path, signal)));
                    if (snapshot.state.handNumber === handNumber) return snapshot;
                } catch (err) {
                    if (signal.aborted) throw err;
                    // Pruned history for this height — fall through to the next candidate.
                }
            }
            throw new Error(
                `Hand #${handNumber} ended at block ${endHeight.toLocaleString()}, but ${currentNetwork.name} no longer keeps that state (history is pruned after ~30 days).`
            );
        };

        const loadSeed = indexerApi
            .getHand(gameId, handNumber, signal)
            .then(hand => hand.deck_seed)
            .catch(() => null);

        Promise.all([load(), loadSeed])
            .then(([snapshot, deckSeed]) => setState({ snapshot, deckSeed, isLoading: false, error: "" }))
            .catch(err => {
                if (signal.aborted) return;
                setState({ snapshot: null, deckSeed: null, isLoading: false, error: err instanceof Error ? err.message : "Failed to load hand" });
            });

        return () => controller.abort();
    }, [gameId, handNumber, currentNetwork]);

    return state;
}
