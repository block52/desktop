import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { SitOutMethod } from "@block52/poker-vm-sdk";
import { SIT_OUT_METHOD_NEXT_HAND } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Sit out in a poker game.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param network - The current network configuration from NetworkContext
 * @param method - The sit-out method: "next-hand" or "next-bb"
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function sitOut(
    tableId: string,
    network: NetworkEndpoints,
    method: SitOutMethod = SIT_OUT_METHOD_NEXT_HAND
): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, NonPlayerActionType.SIT_OUT, 0n, network, `method=${method}`);
}
