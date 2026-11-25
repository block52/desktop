import { useCallback, useEffect, useState } from "react";
import type { TournamentStateDTO } from "@block52/poker-vm-sdk";
import { useNetwork } from "../context/NetworkContext";
import { getCosmosClient } from "../utils/cosmos/client";
import { createdTournamentIds, sortTournaments } from "../utils/tournaments";

const LIST_SIZE = 50;
const CONCURRENCY = 6;

/** Runs `task` over `items` with a few in flight at once; a failed item is dropped. */
async function mapLimited<T, R>(items: T[], task: (item: T) => Promise<R | null>): Promise<R[]> {
    const results: (R | null)[] = new Array(items.length).fill(null);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            try {
                results[index] = await task(items[index]);
            } catch {
                results[index] = null;
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
    return results.filter((result): result is R => result !== null);
}

export interface UseTournamentsReturn {
    tournaments: TournamentStateDTO[];
    isLoading: boolean;
    error: string;
    refetch: () => Promise<void>;
}

/**
 * The newest tournaments. The chain can only look a tournament up by id, so the ids come from the `tournament_created`
 * events (CometBFT tx_search, newest first) and each one is then read from the chain for its current state.
 */
export function useTournaments(): UseTournamentsReturn {
    const { currentNetwork } = useNetwork();
    const [tournaments, setTournaments] = useState<TournamentStateDTO[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        try {
            const rpc = currentNetwork.rpc.replace(/\/+$/, "");
            const query = encodeURIComponent("\"tournament_created.tournament_id EXISTS\"");
            const response = await fetch(`${rpc}/tx_search?query=${query}&per_page=${LIST_SIZE}&order_by=${encodeURIComponent("\"desc\"")}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = (await response.json()) as { result?: { txs?: Parameters<typeof createdTournamentIds>[0] } };
            const client = getCosmosClient(currentNetwork);
            if (client === null) throw new Error("Block52 client not initialized.");
            const found = await mapLimited(createdTournamentIds(data.result?.txs ?? []), id => client.getTournament(id));
            setTournaments(sortTournaments(found));
            setError("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load tournaments");
        } finally {
            setIsLoading(false);
        }
    }, [currentNetwork]);

    useEffect(() => {
        void load();
    }, [load]);

    return { tournaments, isLoading, error, refetch: load };
}
