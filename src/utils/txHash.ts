/** Cosmos/CometBFT tx hash: uppercase hex SHA-256 of the raw tx bytes (base64 in block data). */
export async function txHashFromBase64(base64: string): Promise<string> {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
}
