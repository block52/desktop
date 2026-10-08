import type { NetworkEndpoints } from "../context/NetworkContext";
import { withMoneyMoverRetry } from "../utils/cosmos/client";

export interface RakeConfigParams {
    rakeFreeThreshold: bigint;
    rakePercentage: number;
    rakeCap: bigint;
    owner: string;
}

export interface SngConfigParams {
    startingStack: bigint;
    blindLevelDuration: number;
    entryFee?: bigint;
}

export interface CreateGameParams {
    gameFormat: "cash" | "sit-and-go";
    gameVariant: "texas-holdem" | "omaha";
    minPlayers: number;
    maxPlayers: number;
    minBuyIn: bigint;
    maxBuyIn: bigint;
    smallBlind: bigint;
    bigBlind: bigint;
    timeout: number;
    rakeConfig?: RakeConfigParams;
    sngConfig?: SngConfigParams;
    name?: string;
}

/**
 * Creates a new poker table on-chain. CREATE is a signed, costed
 * transaction like JOIN — retries once on a sequence mismatch caused by a
 * still-pending prior money-mover, matching joinTable's pattern.
 *
 * @returns The new game's ID.
 */
export async function createGame(params: CreateGameParams, network: NetworkEndpoints): Promise<string> {
    return withMoneyMoverRetry(network, ({ signingClient }) =>
        signingClient.createGame(
            params.gameFormat,
            params.gameVariant,
            params.minPlayers,
            params.maxPlayers,
            params.minBuyIn,
            params.maxBuyIn,
            params.smallBlind,
            params.bigBlind,
            params.timeout,
            params.rakeConfig,
            params.sngConfig,
            params.name
        )
    );
}
