import type { GameWithFormat } from "./convertUtils";

/**
 * Picks the Sit & Go to feature on the Lobby: the soonest-to-start one
 * (lowest sngStartTime), falling back to the fullest Sit & Go when none
 * have a start time set. Tournament format is deliberately excluded — only
 * Sit & Go is "featured" in this version.
 */
export function selectFeaturedGame(games: GameWithFormat[]): GameWithFormat | null {
    const sngGames = games.filter(g => g.gameFormat === "sit-and-go");
    if (sngGames.length === 0) return null;

    const withStartTime = sngGames.filter(g => g.sngStartTime !== undefined);
    if (withStartTime.length > 0) {
        return [...withStartTime].sort((a, b) => a.sngStartTime! - b.sngStartTime!)[0];
    }

    return [...sngGames].sort((a, b) => b.currentPlayers - a.currentPlayers)[0];
}
