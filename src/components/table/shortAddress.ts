/** Bech32-style addresses are far wider than a nameplate or log row — keep head and tail. */
export function shortAddress(address: string): string {
    return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
