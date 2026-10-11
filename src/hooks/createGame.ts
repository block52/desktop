import type { NetworkEndpoints } from "../context/NetworkContext";
import { getCosmosClient, withMoneyMoverRetry } from "../utils/cosmos/client";

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

interface TxLookupClient {
    getTx(txHash: string): Promise<unknown>;
}

interface TxResponse {
    code?: number;
    raw_log?: string;
    events?: { type: string; attributes?: { key: string; value: string }[] }[];
}

/**
 * The SDK's createGame resolves with the transaction hash, not the table ID.
 * Poll for the transaction (it is indexed a moment after broadcast) and read
 * `game_id` from its `game_created` event, as the web app does.
 */
export async function waitForGameId(
    client: TxLookupClient,
    txHash: string,
    { attempts = 20, delayMs = 1000 }: { attempts?: number; delayMs?: number } = {}
): Promise<string> {
    for (let attempt = 0; attempt < attempts; attempt++) {
        if (attempt > 0) await new Promise(resolve => setTimeout(resolve, delayMs));

        let response: unknown;
        try {
            response = await client.getTx(txHash);
        } catch {
            continue; // not indexed yet
        }

        const tx = (response as { tx_response?: TxResponse } | null)?.tx_response;
        if (tx === undefined) continue;

        if (tx.code !== undefined && tx.code !== 0) {
            throw new Error(tx.raw_log ?? `Create table transaction failed with code ${tx.code}`);
        }

        const created = tx.events?.find(e => e.type === "game_created");
        const gameId = created?.attributes?.find(a => a.key === "game_id")?.value;
        if (gameId === undefined) {
            throw new Error(`Transaction ${txHash} did not emit a game_created event`);
        }
        return gameId;
    }
    throw new Error(`Table creation transaction ${txHash} was not confirmed in time. Check the lobby shortly.`);
}

/**
 * Creates a new poker table on-chain. CREATE is a signed, costed
 * transaction like JOIN — retries once on a sequence mismatch caused by a
 * still-pending prior money-mover, matching joinTable's pattern.
 *
 * @returns The new game's ID.
 */
export async function createGame(params: CreateGameParams, network: NetworkEndpoints): Promise<string> {
    const txHash = await withMoneyMoverRetry(network, ({ signingClient }) =>
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

    const client = getCosmosClient(network);
    if (!client) {
        throw new Error("Block52 client not initialized");
    }
    return waitForGameId(client, txHash);
}
