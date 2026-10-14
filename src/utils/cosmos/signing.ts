/**
 * Cosmos query signing.
 *
 * Used to prove player identity when subscribing to a table over WebSocket (the server uses this to
 * return the player's own hole cards while masking everyone else's). The signature is made in the main
 * process; the page never holds the key.
 *
 * Message format: "pokerchain-query:<timestamp>"
 * Signature format: Ethereum personal_sign (EIP-191)
 */
import { getCosmosAddress } from "./storage";

/**
 * Creates a signed authentication payload for WebSocket subscription.
 *
 * @returns Authentication payload with address, timestamp, and signature, or null if signing fails
 */
export async function createAuthPayload(): Promise<{
    playerAddress: string;
    timestamp: number;
    signature: string;
} | null> {
    const bridge = window.electronAPI?.wallet;
    const cosmosAddress = getCosmosAddress();
    if (bridge === undefined || cosmosAddress === null) {
        console.error("[signing] No wallet available for auth payload");
        return null;
    }

    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = await bridge.signQuery(timestamp);
        return { playerAddress: cosmosAddress, timestamp, signature };
    } catch (error) {
        console.error("[signing] Failed to create auth payload:", error);
        return null;
    }
}
