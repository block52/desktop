import { useLatchedDelay } from "./useLatchedDelay";

/** What an automatic action needs from the table: the action runs, and a failure is reported once. */
interface AutoActionCallbacks {
    onError?: (error: Error) => void;
}

function toError(err: unknown): Error {
    return err instanceof Error ? err : new Error(String(err));
}

/**
 * Fold — or check, when it is free — once the player's turn clock has run out.
 *
 * Fires once per turn, never while an action of the player's own is in flight (`isBusy`): their action
 * may already be on its way, and a fold queued behind it would land on their next decision.
 */
export function useAutoFold(args: {
    enabled: boolean;
    hasFoldAction: boolean;
    hasCheckAction: boolean;
    isUsersTurn: boolean;
    timeRemaining: number;
    isBusy: boolean;
    fold: () => Promise<unknown>;
    check: () => Promise<unknown>;
    onSubmitted?: (action: "fold" | "check") => void;
} & AutoActionCallbacks): void {
    const { enabled, hasFoldAction, hasCheckAction, isUsersTurn, timeRemaining, isBusy, fold, check, onSubmitted, onError } = args;
    const shouldArm = enabled && (hasFoldAction || hasCheckAction) && isUsersTurn && timeRemaining === 0 && !isBusy;
    const shouldReset = !isUsersTurn || timeRemaining > 0;

    useLatchedDelay(shouldArm, shouldReset, () => {
        if (isBusy) return false;
        // Prefer a free check over a fold; read at fire time, not when the timer armed.
        const action = hasCheckAction ? "check" : "fold";
        (action === "check" ? check() : fold()).then(() => onSubmitted?.(action)).catch(err => onError?.(toError(err)));
        return true;
    });
}

/** Show cards automatically once the turn clock runs out at showdown. */
export function useAutoShowCards(args: {
    hasShowAction: boolean;
    isUsersTurn: boolean;
    timeRemaining: number;
    isBusy: boolean;
    show: () => Promise<unknown>;
    onSubmitted?: () => void;
} & AutoActionCallbacks): void {
    const { hasShowAction, isUsersTurn, timeRemaining, isBusy, show, onSubmitted, onError } = args;
    const shouldArm = hasShowAction && isUsersTurn && timeRemaining === 0 && !isBusy;
    const shouldReset = !isUsersTurn || timeRemaining > 0;

    useLatchedDelay(shouldArm, shouldReset, () => {
        if (isBusy) return false;
        show().then(() => onSubmitted?.()).catch(err => onError?.(toError(err)));
        return true;
    });
}

/** Muck losing cards at showdown the moment it is the player's turn to, when auto-muck is on. */
export function useAutoMuck(args: {
    enabled: boolean;
    hasMuckAction: boolean;
    isUsersTurn: boolean;
    isBusy: boolean;
    muck: () => Promise<unknown>;
    onSubmitted?: () => void;
} & AutoActionCallbacks): void {
    const { enabled, hasMuckAction, isUsersTurn, isBusy, muck, onSubmitted, onError } = args;
    const shouldArm = enabled && hasMuckAction && isUsersTurn && !isBusy;
    // Not clock-driven: the opportunity ends with the turn.
    const shouldReset = !isUsersTurn;

    useLatchedDelay(shouldArm, shouldReset, () => {
        if (isBusy) return false;
        muck().then(() => onSubmitted?.()).catch(err => onError?.(toError(err)));
        return true;
    });
}

/**
 * Pre-selected "Check": when the player queued it and action reaches them with CHECK still free, check once.
 * It can only ever check, never fold: if a bet slipped in (or the player already acted by hand) the intent
 * resolves without acting and the player takes their normal turn.
 */
export function usePreCheck(args: {
    queued: boolean;
    hasCheckAction: boolean;
    isUsersTurn: boolean;
    isBusy: boolean;
    check: () => Promise<unknown>;
    onResolved: () => void;
    onSubmitted?: () => void;
} & AutoActionCallbacks): void {
    const { queued, hasCheckAction, isUsersTurn, isBusy, check, onResolved, onSubmitted, onError } = args;

    useLatchedDelay(queued && isUsersTurn, !isUsersTurn, () => {
        if (hasCheckAction && !isBusy) {
            check().then(() => onSubmitted?.()).catch(err => onError?.(toError(err)));
        }
        // Consumed either way: the box must not stay ticked.
        onResolved();
        return true;
    });
}
