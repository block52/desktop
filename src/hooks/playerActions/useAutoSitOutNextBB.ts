import { useEffect, useRef } from "react";

/**
 * Client-side "Sit out next big blind".
 *
 * The chain has no `next-bb` sit-out method, so the intent is held in the app and the standard
 * `next-hand` sit-out is sent the moment the big blind rotates onto the player's seat: they play out
 * the BB hand, then sit out from the following one. Single-shot per landing; it re-arms once the big
 * blind moves off the seat (a new hand).
 */
export function useAutoSitOutNextBB(
    userSeat: number | undefined,
    bigBlindPosition: number | undefined,
    enabled: boolean,
    onTrigger: () => void
): void {
    const hasTriggeredRef = useRef<boolean>(false);

    useEffect(() => {
        const seatIsBigBlind = userSeat !== undefined && bigBlindPosition !== undefined && userSeat === bigBlindPosition;

        if (enabled && seatIsBigBlind && !hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            onTrigger();
            return;
        }

        if (!seatIsBigBlind) {
            hasTriggeredRef.current = false;
        }
    }, [enabled, userSeat, bigBlindPosition, onTrigger]);
}
