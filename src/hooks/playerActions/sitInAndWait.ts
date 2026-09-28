import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Sit in AND wait for the big blind (cash games).
 *
 * Unlike sit-in "post now", this submits the engine's distinct
 * SIT_IN_AND_WAIT action, which parks the player in WAITING_FOR_BIG_BLIND
 * until the big blind rotates onto their seat, then activates them so they
 * enter by posting the BB. No `method=` payload — the wait intent IS the
 * action.
 *
 * @param tableId - Game ID on Cosmos.
 * @param network - Current network configuration from NetworkContext.
 */
export async function sitInAndWait(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, NonPlayerActionType.SIT_IN_AND_WAIT, 0n, network);
}
