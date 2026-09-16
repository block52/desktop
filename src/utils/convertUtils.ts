import { GameListItem, GameFormat, GameVariant, getGameFormat, getGameVariant } from "@block52/poker-vm-sdk";

export interface GameWithFormat {
    gameId: string;
    minBuyIn: string;
    maxBuyIn: string;
    minPlayers: number;
    maxPlayers: number;
    currentPlayers: number;
    gameFormat: GameFormat | "unknown";
    gameVariant: GameVariant | "unknown";
    smallBlind: string;
    bigBlind: string;
    creator?: string;
    timeout?: number;
    createdAt?: string;
}

export const convertGameListItemToGameWithFormat = (game: GameListItem): GameWithFormat => {
    if (!game.gameOptions) throw new Error(`Game ${game.gameId} is missing gameOptions`);
    const opts = game.gameOptions;
    return {
        gameId:         game.gameId,
        minBuyIn:       opts.minBuyIn,
        maxBuyIn:       opts.maxBuyIn,
        minPlayers:     opts.minPlayers,
        maxPlayers:     opts.maxPlayers,
        currentPlayers: game.currentPlayers ?? 0,
        gameFormat:     getGameFormat(game.format),
        gameVariant:    getGameVariant(game.variant),
        smallBlind:     opts.smallBlind,
        bigBlind:       opts.bigBlind,
        creator:        game.creator,
        timeout:        opts.timeout,
        createdAt:      game.createdAt,
    };
};

export const convertGameList = (games: GameListItem[]): GameWithFormat[] =>
    games
        .filter(g => {
            if (!g.gameOptions) { console.warn("[convertGameList] skipping game missing gameOptions:", g.gameId); return false; }
            return true;
        })
        .map(convertGameListItemToGameWithFormat);
