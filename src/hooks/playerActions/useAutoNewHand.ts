import { useCallback, useEffect, useRef, useState } from "react";
import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { startNewHand } from "./startNewHand";
import { useGameState } from "../../context/GameStateContext";
import { getCosmosAddress } from "../../utils/cosmos/storage";

/**
 * Automatically triggers a new hand when the current hand ends.
 *
 * Enabled by default; pass `enabled={false}` to turn it off.
 *
 * Triggers the new-hand action when:
 * 1. The user has the NEW_HAND action in their legal actions
 * 2. It is the user's turn
 * 3. Auto-new-hand has not already been triggered for this opportunity
 *
 * Because dealing a new hand is an action SUBMISSION, its trigger inputs
 * are derived from `getLatestSnapshot()` (the freshest ingested snapshot),
 * NOT any paced/rendered state — a delayed snapshot would submit against a
 * stale action index. `latestEvents` is read only as the reactive tick that
 * re-runs the check on each commit; the DATA read is always the latest
 * snapshot.
 *
 * @param tableId - The table/game ID
 * @param network - The network configuration
 * @param onNewHandStarted - Optional callback when auto-new-hand starts
 * @param onNewHandComplete - Optional callback when auto-new-hand completes
 * @param onNewHandError - Optional callback when auto-new-hand fails
 * @param enabled - Optional on/off override, defaults to true
 * @returns `{ isDealingNewHand }` — true from the hand-ended commit until the
 *          next hand starts (or the deal fails), so the UI can show a
 *          "Dealing hand #X…" indicator.
 */
export function useAutoNewHand(
    tableId: string,
    network: NetworkEndpoints,
    onNewHandStarted?: () => void,
    onNewHandComplete?: (txHash: string) => void,
    onNewHandError?: (error: Error) => void,
    enabled?: boolean
): { isDealingNewHand: boolean } {
    const hasTriggeredRef = useRef<boolean>(false);
    const isProcessingRef = useRef<boolean>(false);
    const autoNewHandEnabledRef = useRef<boolean>(enabled ?? true);
    const [isDealingNewHand, setIsDealingNewHand] = useState<boolean>(false);

    // Wallet address is stable for the session — read once.
    const [localAddress] = useState<string | null>(() => {
        const address = getCosmosAddress();
        return address ? address.toLowerCase() : null;
    });

    const { getLatestSnapshot, latestEvents } = useGameState();

    useEffect(() => {
        autoNewHandEnabledRef.current = enabled ?? true;
    }, [enabled]);

    const triggerAutoNewHand = useCallback(async () => {
        if (!tableId || isProcessingRef.current) {
            return;
        }

        isProcessingRef.current = true;
        onNewHandStarted?.();

        try {
            const result = await startNewHand(tableId, network);
            onNewHandComplete?.(result.hash);
            // Leave isDealingNewHand true on success — cleared by the effect
            // below when the next hand starts (hasNewHandAction goes false).
        } catch (error) {
            console.error("Auto-new-hand failed:", error);
            setIsDealingNewHand(false);
            onNewHandError?.(error instanceof Error ? error : new Error(String(error)));
        } finally {
            isProcessingRef.current = false;
        }
    }, [tableId, network, onNewHandStarted, onNewHandComplete, onNewHandError]);

    useEffect(() => {
        // `latestEvents` is the reactive tick only; the decision reads the
        // latest snapshot directly so the deal is never delayed by pacing.
        void latestEvents;
        const snapshot = getLatestSnapshot();
        const localPlayer = snapshot?.players.find(player => player.address.toLowerCase() === localAddress);
        const hasNewHandAction = !!localPlayer?.legalActions.some(action => action.action === NonPlayerActionType.NEW_HAND);
        const isUsersTurn = !!localPlayer && snapshot?.nextToAct === localPlayer.seat;

        const shouldAutoNewHand =
            autoNewHandEnabledRef.current && hasNewHandAction && isUsersTurn && !hasTriggeredRef.current && !isProcessingRef.current;

        if (shouldAutoNewHand) {
            hasTriggeredRef.current = true;
            setIsDealingNewHand(true);
            triggerAutoNewHand();
        }

        // New-hand opportunity gone (a hand started — by us or another
        // player). Reset so the next hand-end re-arms, and drop the
        // dealing indicator.
        if (!hasNewHandAction) {
            hasTriggeredRef.current = false;
            setIsDealingNewHand(false);
        }
    }, [latestEvents, getLatestSnapshot, localAddress, triggerAutoNewHand]);

    return { isDealingNewHand };
}
