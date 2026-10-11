import { GameListItem, GameFormat, GameVariant, getGameFormat, getGameVariant } from "@block52/poker-vm-sdk";

export interface GameWithFormat {
    gameId: string;
    name?: string;
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
    sngStartTime?: number;
}

export const convertGameListItemToGameWithFormat = (game: GameListItem): GameWithFormat => {
    if (!game.gameOptions) throw new Error(`Game ${game.gameId} is missing gameOptions`);
    const opts = game.gameOptions;
    return {
        gameId:         game.gameId,
        name:           game.name,
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
        sngStartTime:   opts.sngStartTime,
    };
};

export const convertGameList = (games: GameListItem[]): GameWithFormat[] =>
    games
        .filter(g => {
            if (!g.gameOptions) { console.warn("[convertGameList] skipping game missing gameOptions:", g.gameId); return false; }
            return true;
        })
        .map(convertGameListItemToGameWithFormat);

/** Newest first by createdAt; games without a timestamp sort last. Does not mutate the input. */
export const sortGamesNewestFirst = (games: GameWithFormat[]): GameWithFormat[] =>
    [...games].sort((a, b) => {
        const aTime = a.createdAt === undefined ? Number.NEGATIVE_INFINITY : Date.parse(a.createdAt);
        const bTime = b.createdAt === undefined ? Number.NEGATIVE_INFINITY : Date.parse(b.createdAt);
        if (aTime === bTime) return 0;
        return bTime > aTime ? 1 : -1;
    });
