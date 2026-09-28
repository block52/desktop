import { useCallback, useEffect, useRef } from "react";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { postSmallBlind } from "./postSmallBlind";
import { postBigBlind } from "./postBigBlind";

/**
 * Automatically posts the small or big blind when conditions are met.
 *
 * Enabled by default; pass `enabled={false}` to turn it off.
 *
 * When enabled, posts a blind when:
 * 1. The user has the SMALL_BLIND or BIG_BLIND action in their legal actions
 * 2. It is the user's turn
 * 3. The blind has not already been posted for this opportunity
 *
 * @param tableId - The table/game ID
 * @param network - The network configuration
 * @param hasSmallBlindAction - Whether the SMALL_BLIND action is available in legal actions
 * @param hasBigBlindAction - Whether the BIG_BLIND action is available in legal actions
 * @param smallBlindAmount - The small blind amount in micro-units as bigint
 * @param bigBlindAmount - The big blind amount in micro-units as bigint
 * @param isUsersTurn - Whether it is currently the user's turn
 * @param onBlindStarted - Optional callback when auto-post blind starts
 * @param onBlindComplete - Optional callback when auto-post blind completes
 * @param onBlindError - Optional callback when auto-post blind fails
 * @param enabled - Optional on/off override, defaults to true
 */
export function useAutoPostBlinds(
    tableId: string,
    network: NetworkEndpoints,
    hasSmallBlindAction: boolean,
    hasBigBlindAction: boolean,
    smallBlindAmount: bigint,
    bigBlindAmount: bigint,
    isUsersTurn: boolean,
    onBlindStarted?: (blindType: "small" | "big") => void,
    onBlindComplete?: (blindType: "small" | "big", txHash: string) => void,
    onBlindError?: (error: Error) => void,
    enabled?: boolean
): void {
    const hasTriggeredSmallBlindRef = useRef<boolean>(false);
    const hasTriggeredBigBlindRef = useRef<boolean>(false);
    const isProcessingRef = useRef<boolean>(false);
    const autoPostBlindsEnabledRef = useRef<boolean>(enabled ?? true);

    useEffect(() => {
        autoPostBlindsEnabledRef.current = enabled ?? true;
    }, [enabled]);

    const triggerPostSmallBlind = useCallback(async () => {
        if (!tableId || isProcessingRef.current || smallBlindAmount === 0n) {
            return;
        }

        isProcessingRef.current = true;
        onBlindStarted?.("small");

        try {
            const result = await postSmallBlind(tableId, smallBlindAmount, network);
            onBlindComplete?.("small", result.hash);
        } catch (error) {
            console.error("Auto-post small blind failed:", error);
            onBlindError?.(error instanceof Error ? error : new Error(String(error)));
        } finally {
            isProcessingRef.current = false;
        }
    }, [tableId, network, smallBlindAmount, onBlindStarted, onBlindComplete, onBlindError]);

    const triggerPostBigBlind = useCallback(async () => {
        if (!tableId || isProcessingRef.current || bigBlindAmount === 0n) {
            return;
        }

        isProcessingRef.current = true;
        onBlindStarted?.("big");

        try {
            const result = await postBigBlind(tableId, bigBlindAmount, network);
            onBlindComplete?.("big", result.hash);
        } catch (error) {
            console.error("Auto-post big blind failed:", error);
            onBlindError?.(error instanceof Error ? error : new Error(String(error)));
        } finally {
            isProcessingRef.current = false;
        }
    }, [tableId, network, bigBlindAmount, onBlindStarted, onBlindComplete, onBlindError]);

    useEffect(() => {
        const shouldPostSmallBlind =
            autoPostBlindsEnabledRef.current &&
            hasSmallBlindAction &&
            isUsersTurn &&
            !hasTriggeredSmallBlindRef.current &&
            !isProcessingRef.current;

        if (shouldPostSmallBlind) {
            hasTriggeredSmallBlindRef.current = true;
            triggerPostSmallBlind();
        }

        if (!hasSmallBlindAction) {
            hasTriggeredSmallBlindRef.current = false;
        }
    }, [hasSmallBlindAction, isUsersTurn, triggerPostSmallBlind]);

    useEffect(() => {
        const shouldPostBigBlind =
            autoPostBlindsEnabledRef.current &&
            hasBigBlindAction &&
            isUsersTurn &&
            !hasTriggeredBigBlindRef.current &&
            !isProcessingRef.current;

        if (shouldPostBigBlind) {
            hasTriggeredBigBlindRef.current = true;
            triggerPostBigBlind();
        }

        if (!hasBigBlindAction) {
            hasTriggeredBigBlindRef.current = false;
        }
    }, [hasBigBlindAction, isUsersTurn, triggerPostBigBlind]);
}
