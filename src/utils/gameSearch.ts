import { GameVariant, isTournamentFormat } from "@block52/poker-vm-sdk";
import type { GameWithFormat } from "./convertUtils";

/**
 * Does a lobby table match the search text? Matches what a user can actually see
 * or type, since almost all tables have no name (#38): the full/short game id,
 * the name, the creator address, the variant (holdem/nlh, omaha/plo) and the
 * format (cash, sng / sit-and-go / tournament). `q` must already be lowercased.
 */
export function gameMatchesSearch(game: GameWithFormat, q: string): boolean {
    if (q === "") return true;

    if (game.gameId.toLowerCase().includes(q)) return true; // full id or the visible short id (a substring)
    if (game.name !== undefined && game.name.toLowerCase().includes(q)) return true;
    if (game.creator !== undefined && game.creator.toLowerCase().includes(q)) return true;

    return variantTerms(game).some(term => term.includes(q)) || formatTerms(game).some(term => term.includes(q));
}

function variantTerms(game: GameWithFormat): string[] {
    if (game.gameVariant === GameVariant.TEXAS_HOLDEM) return ["holdem", "nlh", "texas"];
    if (game.gameVariant === GameVariant.OMAHA) return ["omaha", "plo"];
    return [String(game.gameVariant).toLowerCase()];
}

function formatTerms(game: GameWithFormat): string[] {
    const raw = String(game.gameFormat).toLowerCase();
    if (isTournamentFormat(game.gameFormat) || raw.includes("sng") || raw.includes("sit")) {
        return ["sng", "sit-and-go", "sit and go", "tournament", "tourney"];
    }
    return ["cash", "ring"];
}
