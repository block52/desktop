/**
 * Seconds left in the current blind level: the level's length minus time already spent in it.
 * Negative while a hand runs past the end of the level (the server holds the level steady until the
 * hand completes), and null when the level's start time is unknown.
 */
export function blindLevelSecondsRemaining(levelStartTimeMs: number | undefined, durationMinutes: number, nowMs: number): number | null {
    if (levelStartTimeMs === undefined || levelStartTimeMs <= 0 || durationMinutes <= 0) return null;
    const elapsedSeconds = Math.floor((nowMs - levelStartTimeMs) / 1000);
    return durationMinutes * 60 - elapsedSeconds;
}

/** "3:42", or "-0:10" while the level is in overtime. */
export function formatCountdown(totalSeconds: number): string {
    const sign = totalSeconds < 0 ? "-" : "";
    const abs = Math.abs(totalSeconds);
    const minutes = Math.floor(abs / 60);
    const seconds = abs % 60;
    return `${sign}${minutes}:${seconds.toString().padStart(2, "0")}`;
}
