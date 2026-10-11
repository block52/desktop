import { useEffect, useRef } from "react";

/** Settle time before an automatic action fires, so it never acts on a half-applied state. */
export const AUTO_ACTION_DELAY_MS = 500;

/**
 * The "latch, wait, fire once" core shared by the automatic-action hooks (ported from the web app).
 *
 * While `shouldArm` is true and the latch is open it latches and starts the settle timer; `fire`
 * runs once when it elapses. The latch reopens when `shouldReset` is true (the opportunity passed).
 * `fire` is read through a ref so a fresh closure every render can neither restart nor cancel the
 * timer, and a timer cancelled before it fired reopens the latch. `fire` returns false to say "I did
 * not act after all", which also reopens the latch.
 */
export function useLatchedDelay(shouldArm: boolean, shouldReset: boolean, fire: () => boolean, delayMs: number = AUTO_ACTION_DELAY_MS): void {
    const latchedRef = useRef<boolean>(false);
    const fireRef = useRef(fire);
    useEffect(() => {
        fireRef.current = fire;
    });

    useEffect(() => {
        if (shouldArm && !latchedRef.current) {
            latchedRef.current = true;
            let fired = false;
            const timeoutId = setTimeout(() => {
                fired = true;
                if (!fireRef.current()) {
                    latchedRef.current = false;
                }
            }, delayMs);
            return () => {
                clearTimeout(timeoutId);
                if (!fired) {
                    latchedRef.current = false;
                }
            };
        }

        if (shouldReset) {
            latchedRef.current = false;
        }
    }, [shouldArm, shouldReset, delayMs]);
}
