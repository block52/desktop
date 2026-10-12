import { useEffect, useState } from "react";
import { TexasHoldemRound, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { latestActionTimestampMs, secondsRemaining, turnId } from "../utils/turnTimer";

const DEFAULT_TIMEOUT_SECONDS = 30;

interface TurnTimer {
    /** Identifies the current turn; changes when anyone acts or the seat to act changes. */
    turnKey: string;
    /** Seconds the seat to act has in total. */
    timeoutSeconds: number;
    /** Whole seconds left for the seat to act; 0 when nobody is to act. */
    timeRemaining: number;
}

/**
 * The seat-to-act's countdown. Anchored on the latest action's timestamp and held steady within a turn,
 * so a re-broadcast that re-stamps the last action can't make the clock jump back up.
 */
export function useTurnTimer(gameState: TexasHoldemStateDTO | undefined): TurnTimer {
    const [now, setNow] = useState(() => Date.now());
    const [anchored, setAnchored] = useState<{ key: string; ms: number }>({ key: "", ms: 0 });

    // Before the table loads there is no clock; afterwards the table's own timeout and seat are used as sent.
    const timeoutSeconds = gameState !== undefined ? gameState.gameOptions.timeout : DEFAULT_TIMEOUT_SECONDS;
    const nextToAct = gameState !== undefined ? gameState.nextToAct : 0;
    const turnKey = gameState !== undefined ? turnId(nextToAct, gameState.previousActions.length) : "";
    // No clock once the hand (or the tournament) is over, even though the table still names a seat to act.
    const isRunning = gameState !== undefined && nextToAct > 0 && gameState.players.length >= 2 && gameState.round !== TexasHoldemRound.END;

    // Re-anchor only when the turn itself changes (derived state, set during render).
    if (gameState !== undefined && anchored.key !== turnKey) {
        setAnchored({ key: turnKey, ms: latestActionTimestampMs(gameState.previousActions, 0) });
    }

    useEffect(() => {
        if (!isRunning) return;
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [isRunning, turnKey]);

    // An empty hand has no anchor: show the full clock rather than counting from the epoch.
    const timeRemaining =
        isRunning && anchored.key === turnKey && anchored.ms > 0 ? secondsRemaining(now, anchored.ms, timeoutSeconds) : isRunning ? timeoutSeconds : 0;

    return { turnKey, timeoutSeconds, timeRemaining };
}
