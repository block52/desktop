import { useCallback, useEffect, useState } from "react";
import type { TournamentStateDTO } from "@block52/poker-vm-sdk";
import { useNetwork } from "../context/NetworkContext";
import { getCosmosClient } from "../utils/cosmos/client";

export interface UseTournamentReturn {
    tournament: TournamentStateDTO | null;
    isLoading: boolean;
    error: string;
    refetch: () => Promise<void>;
}

/** One tournament by id, polled while `id` is set. `tournament` stays null when the chain has none with that id. */
export function useTournament(id: string | null, pollMs = 0): UseTournamentReturn {
    const { currentNetwork } = useNetwork();
    const [tournament, setTournament] = useState<TournamentStateDTO | null>(null);
    const [isLoading, setIsLoading] = useState(id !== null);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        if (id === null) return;
        try {
            const client = getCosmosClient(currentNetwork);
            if (client === null) throw new Error("Block52 client not initialized.");
            setTournament(await client.getTournament(id));
            setError("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load the tournament");
        } finally {
            setIsLoading(false);
        }
    }, [currentNetwork, id]);

    useEffect(() => {
        void load();
        if (pollMs <= 0) return;
        const timer = setInterval(() => void load(), pollMs);
        return () => clearInterval(timer);
    }, [load, pollMs]);

    return { tournament, isLoading, error, refetch: load };
}
