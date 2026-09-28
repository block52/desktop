import { NonPlayerActionType, SIT_IN_METHOD_POST_NOW } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Sit in at a poker table (post-now method — the only live sit-in path;
 * "next-bb" is deferred upstream and not exposed here).
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function sitIn(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, NonPlayerActionType.SIT_IN, 0n, network, `method=${SIT_IN_METHOD_POST_NOW}`);
}
