/**
 * The Go wallet sidecar's file name on a platform. Windows needs the .exe extension to start it. The app looks for
 * this name (src/wallet/goSidecar.ts) and forge builds and bundles exactly this name (forge.config.ts), so the two
 * cannot drift apart. No Electron imports here: forge.config.ts loads this file at build time.
 */
export function sidecarBinaryName(platform: string): string {
    return platform === "win32" ? "b52-wallet.exe" : "b52-wallet";
}
