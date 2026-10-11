import { useEffect, useRef } from "react";
import type { ActionDTO } from "@block52/poker-vm-sdk";
import { playTableSound, soundForAction } from "../utils/tableSounds";

/**
 * Plays a cue for each new action on the table, and a chime when it becomes the player's turn.
 * Actions already on the table when the hook first sees it are history and stay silent.
 */
export function useTableSounds(args: {
    previousActions: readonly ActionDTO[] | undefined;
    isUsersTurn: boolean;
    actionSounds: boolean;
    turnSound: boolean;
}): void {
    const { previousActions, isUsersTurn, actionSounds, turnSound } = args;
    const lastIndexRef = useRef<number | null>(null);
    const wasUsersTurnRef = useRef<boolean>(false);

    useEffect(() => {
        if (previousActions === undefined) return;
        const newest = previousActions.reduce((max, a) => (a.index > max ? a.index : max), -1);
        if (lastIndexRef.current === null) {
            lastIndexRef.current = newest;
            return;
        }
        if (newest > lastIndexRef.current) {
            if (actionSounds) {
                // Newest action wins when several arrive in one frame.
                const latest = previousActions.find(a => a.index === newest);
                const sound = latest !== undefined ? soundForAction(latest.action) : null;
                if (sound !== null) playTableSound(sound);
            }
        }
        lastIndexRef.current = newest;
    }, [previousActions, actionSounds]);

    useEffect(() => {
        if (isUsersTurn && !wasUsersTurnRef.current && turnSound) {
            playTableSound("chip-notification", 0.3);
        }
        wasUsersTurnRef.current = isUsersTurn;
    }, [isUsersTurn, turnSound]);
}
