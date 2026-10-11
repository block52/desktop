import { useCallback, useEffect, useRef, useState } from "react";
import { GameFormat, isTournamentFormat, type GameStateResponseDTO } from "@block52/poker-vm-sdk";
import { useNetwork } from "../context/NetworkContext";
import { getCosmosClient } from "../utils/cosmos/client";
import type { PlayerHand } from "../utils/indexer";
import { fetchWalletHands } from "../utils/walletHands";

const PAGE_SIZE = 25;

export interface MyHandsState {
    hands: PlayerHand[];
    total: number;
    isLoading: boolean;
    error: string;
    hasMore: boolean;
    /** The indexer had no hands attributed to the wallet; these were matched from its table sessions. */
    estimated: boolean;
    loadMore: () => void;
    reload: () => void;
    /** true = chips (Sit & Go / tournament), false = micro-USDC; absent while unknown. */
    chipTables: Map<string, boolean>;
}

/** Each table's unit (true = chips, false = micro-USDC), resolved once per table via the spectator read. */
export function useChipTables(hands: PlayerHand[]): Map<string, boolean> {
    const { currentNetwork } = useNetwork();
    const [chipTables, setChipTables] = useState<Map<string, boolean>>(new Map());
    const requestedTables = useRef(new Set<string>());

    useEffect(() => {
        requestedTables.current = new Set();
        setChipTables(new Map());
    }, [currentNetwork]);

    useEffect(() => {
        const client = getCosmosClient(currentNetwork);
        if (!client) return;
        const missing = [...new Set(hands.map(hand => hand.game_id))].filter(id => !requestedTables.current.has(id));
        for (const id of missing) {
            requestedTables.current.add(id);
            client
                .getGame(id)
                .then(response => {
                    if (!response.game || response.game === "null") return;
                    const parsed: unknown = JSON.parse(response.game);
                    if (typeof parsed !== "object" || parsed === null || !("format" in parsed)) return;
                    const { format } = parsed as GameStateResponseDTO;
                    const isChips = format === GameFormat.SIT_AND_GO || isTournamentFormat(format);
                    setChipTables(previous => new Map(previous).set(id, isChips));
                })
                // Forget the attempt so a later hands update retries this table.
                .catch(() => requestedTables.current.delete(id));
        }
    }, [hands, currentNetwork]);

    return chipTables;
}

/** Finished hands a wallet played (newest first), paged, plus each table's unit. */
export function useMyHands(address: string | null): MyHandsState {
    const { currentNetwork } = useNetwork();
    const [hands, setHands] = useState<PlayerHand[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [nonce, setNonce] = useState(0);
    const [loadedCount, setLoadedCount] = useState(0);
    const [estimated, setEstimated] = useState(false);
    // Bumped whenever the list is reset, so a page still loading for the old wallet is dropped.
    const generation = useRef(0);

    // Fresh list on wallet / network change or reload.
    useEffect(() => {
        setHands([]);
        setTotal(0);
        setError("");
        setLoadedCount(0);
        generation.current += 1;
        if (address === null) return;
        const controller = new AbortController();
        setIsLoading(true);
        fetchWalletHands(address, PAGE_SIZE, 0, controller.signal)
            .then(res => {
                setHands(res.data);
                setTotal(res.total);
                setLoadedCount(res.data.length);
                setEstimated(res.estimated);
            })
            .catch(err => {
                if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Failed to load hands");
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false);
            });
        return () => controller.abort();
    }, [address, currentNetwork, nonce]);

    const loadMore = useCallback(() => {
        if (address === null || isLoading) return;
        setIsLoading(true);
        const requestedGeneration = generation.current;
        fetchWalletHands(address, PAGE_SIZE, loadedCount)
            .then(res => {
                if (generation.current !== requestedGeneration) return;
                setHands(prev => {
                    const seen = new Set(prev.map(hand => `${hand.game_id}#${hand.hand_number}`));
                    return [...prev, ...res.data.filter(hand => !seen.has(`${hand.game_id}#${hand.hand_number}`))];
                });
                setLoadedCount(count => count + res.data.length);
                setTotal(res.total);
            })
            .catch(err => {
                if (generation.current === requestedGeneration) setError(err instanceof Error ? err.message : "Failed to load hands");
            })
            .finally(() => {
                if (generation.current === requestedGeneration) setIsLoading(false);
            });
    }, [address, isLoading, loadedCount]);

    const chipTables = useChipTables(hands);

    const reload = useCallback(() => setNonce(count => count + 1), []);

    return { hands, total, isLoading, error, hasMore: hands.length < total, estimated, loadMore, reload, chipTables };
}
