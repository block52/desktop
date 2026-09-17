/**
 * Cosmos query signing utilities.
 *
 * Used to prove player identity when subscribing to a table over WebSocket
 * (the server uses this to return the player's own hole cards while masking
 * everyone else's). This is a plain message signature, not a Cosmos SDK
 * transaction — it does not use the signing-client path deposit/withdraw use.
 *
 * Message format: "pokerchain-query:<timestamp>"
 * Signature format: Ethereum personal_sign (EIP-191)
 */
import { ethers } from "ethers";
import { getCosmosMnemonic, getCosmosAddress } from "./storage";

// Cosmos HD derivation path (same path the wallet/signing-client code already uses).
const COSMOS_HD_PATH = "m/44'/118'/0'/0/0";

/**
 * Signs a query message with the user's mnemonic for WebSocket authentication.
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns The hex-encoded signature with 0x prefix, or null if no mnemonic
 */
export async function signQueryMessage(timestamp: number): Promise<string | null> {
    const mnemonic = getCosmosMnemonic();
    if (!mnemonic) {
        console.error("[signing] No mnemonic found in storage");
        return null;
    }

    try {
        const message = `pokerchain-query:${timestamp}`;
        const hdWallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, COSMOS_HD_PATH);
        const signature = await hdWallet.signMessage(message);
        return signature;
    } catch (error) {
        console.error("[signing] Failed to sign query message:", error);
        return null;
    }
}

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
    const mnemonic = getCosmosMnemonic();
    if (!mnemonic) {
        console.error("[signing] No mnemonic found for auth payload");
        return null;
    }

    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = await signQueryMessage(timestamp);

        if (!signature) {
            return null;
        }

        const cosmosAddress = getCosmosAddress();
        if (!cosmosAddress) {
            console.error("[signing] No Cosmos address found in storage");
            return null;
        }

        return {
            playerAddress: cosmosAddress,
            timestamp,
            signature,
        };
    } catch (error) {
        console.error("[signing] Failed to create auth payload:", error);
        return null;
    }
}
