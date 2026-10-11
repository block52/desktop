import type { PlayerActionResult } from "../../types";
import type { GameSettings } from "../useGameSettings";
import { useAutoFold, useAutoMuck, useAutoShowCards, usePreCheck } from "./useAutoActions";

/** The caller already reported the failure (or a click was in flight), so the auto action stays quiet. */
class AutoActionNotSent extends Error {}

interface TableAutoPlayArgs {
    settings: GameSettings;
    hasFoldAction: boolean;
    hasCheckAction: boolean;
    hasMuckAction: boolean;
    hasShowAction: boolean;
    isUsersTurn: boolean;
    timeRemaining: number;
    /** An action is in flight or its table frame has not landed yet. */
    isBusy: boolean;
    /** The table's single submission path; resolves false when it did not go out. */
    runAction: (label: string, action: () => Promise<PlayerActionResult>) => Promise<boolean>;
    fold: () => Promise<PlayerActionResult>;
    check: () => Promise<PlayerActionResult>;
    show: () => Promise<PlayerActionResult>;
    muck: () => Promise<PlayerActionResult>;
    queuedPreCheck: boolean;
    onPreCheckResolved: () => void;
    onTimedOut: (message: string) => void;
}

/** Turn-clock fold/check, showdown show/muck and the pre-selected check, all sent through the table's own action path. */
export function useTableAutoPlay({
    settings,
    hasFoldAction,
    hasCheckAction,
    hasMuckAction,
    hasShowAction,
    isUsersTurn,
    timeRemaining,
    isBusy,
    runAction,
    fold,
    check,
    show,
    muck,
    queuedPreCheck,
    onPreCheckResolved,
    onTimedOut
}: TableAutoPlayArgs): void {
    const send = async (label: string, action: () => Promise<PlayerActionResult>): Promise<void> => {
        if (!(await runAction(label, action))) throw new AutoActionNotSent();
    };
    // runAction has already shown the error for a failed submission.
    const ignoreNotSent = (): void => undefined;

    useAutoFold({
        enabled: settings.autoFold,
        hasFoldAction,
        hasCheckAction,
        isUsersTurn,
        timeRemaining,
        isBusy,
        fold: () => send("Fold", fold),
        check: () => send("Check", check),
        onSubmitted: action => onTimedOut(action === "check" ? "Time ran out — checked for you" : "Time ran out — folded for you"),
        onError: ignoreNotSent
    });
    useAutoShowCards({
        hasShowAction,
        isUsersTurn,
        timeRemaining,
        isBusy,
        show: () => send("Show", show),
        onError: ignoreNotSent
    });
    useAutoMuck({
        enabled: settings.autoMuck,
        hasMuckAction,
        isUsersTurn,
        isBusy,
        muck: () => send("Muck", muck),
        onError: ignoreNotSent
    });
    usePreCheck({
        queued: queuedPreCheck,
        hasCheckAction,
        isUsersTurn,
        isBusy,
        check: () => send("Check", check),
        onResolved: onPreCheckResolved,
        onError: ignoreNotSent
    });
}
