/**
 * Shared client entropy generation.
 *
 * Used by the new-hand player seed (chain-authoritative deck shuffling).
 * Keeping one generator avoids two copies of the CSPRNG drifting apart.
 */

/**
 * 32-byte (256-bit) system entropy as "0x"+hex, via webcrypto.
 */
export function generateSystemEntropy(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return "0x" + Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * The system entropy as BARE 32-byte hex (no 0x prefix) — the exact format
 * the chain's ParsePlayerSeed expects for a new-hand "seed=<hex>". The
 * acting player carries this on new-hand; the chain folds it into the
 * per-hand VRF, so the client never picks the deck.
 */
export function generatePlayerSeedHex(): string {
    return generateSystemEntropy().slice(2);
}
