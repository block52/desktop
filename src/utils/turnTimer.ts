import type { ActionDTO } from "@block52/poker-vm-sdk";

/** Server action timestamps arrive as Unix seconds (10 digits) or milliseconds (13 digits). */
export function normalizeTimestamp(timestamp: number): number {
    return timestamp < 1e12 ? timestamp * 1000 : timestamp;
}

/** Newest action's timestamp in ms; `fallbackMs` when the hand has no actions yet. */
export function latestActionTimestampMs(previousActions: readonly ActionDTO[], fallbackMs: number): number {
    if (previousActions.length === 0) return fallbackMs;
    const newest = previousActions.reduce((max, a) => (a.timestamp > max ? a.timestamp : max), previousActions[0].timestamp);
    return normalizeTimestamp(newest);
}

/** Whole seconds left on a turn clock (never negative). */
export function secondsRemaining(nowMs: number, anchorMs: number, timeoutSeconds: number): number {
    const remainingMs = Math.max(0, timeoutSeconds * 1000 - (nowMs - anchorMs));
    return Math.ceil(remainingMs / 1000);
}

/** Identifies one turn: who is to act and how many actions have been committed. */
export function turnId(nextToAct: number, actionCount: number): string {
    return `${nextToAct}:${actionCount}`;
}
