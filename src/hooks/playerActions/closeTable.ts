import type { NetworkEndpoints } from "../../context/NetworkContext";
import { getSigningClient } from "../../utils/cosmos/client";

/** Remove an empty table. Creator only; the chain rejects it while anyone is seated. */
export async function deleteTable(network: NetworkEndpoints, gameId: string): Promise<string> {
    const { signingClient } = await getSigningClient(network);
    return signingClient.deleteGame(gameId);
}

/**
 * Close a table that still has players: cancels the hand, refunds every stack (plus queued top-ups) to the
 * players' wallets and removes the table. Creator only, cash games only (the chain rejects tournaments).
 */
export async function forceCloseTable(network: NetworkEndpoints, gameId: string): Promise<string> {
    const { signingClient } = await getSigningClient(network);
    return signingClient.forceCloseGame(gameId);
}
