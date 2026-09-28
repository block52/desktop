import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { generatePlayerSeedHex } from "../../utils/entropy";
import { executeTransportAction } from "./transportAction";

/**
 * Start a new hand at a poker table.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where to start a new hand
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function startNewHand(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    // The chain is the authoritative deck source. The acting player supplies
    // 32 bytes of entropy as data "seed=<hex>"; the chain shuffles the deck
    // deterministically from it. The client never picks the deck.
    const data = `seed=${generatePlayerSeedHex()}`;
    return executeTransportAction(tableId, NonPlayerActionType.NEW_HAND, 0n, network, data);
}
