/**
 * Whether game actions and sendTokens are signed and broadcast by the Go wallet sidecar (the default) rather than
 * the TypeScript SDK. Only VITE_GO_SIGNER=false switches back to the SDK; unset, empty or any other value keeps Go.
 *
 * Pure (no Electron or DOM APIs), so the renderer (hooks/playerActions/goSigner.ts) and the main process
 * (walletIpc.ts) share the one rule and can never disagree about which signer is in use.
 */
export function goSignerOn(value: string | undefined): boolean {
    return value === undefined || value.trim().toLowerCase() !== "false";
}
