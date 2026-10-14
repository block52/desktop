import type { WalletBridge } from "../../wallet/types";

export function requireWalletBridge(): WalletBridge {
    const bridge = window.electronAPI?.wallet;
    if (bridge === undefined) throw new Error("The Block52 wallet is only available in the desktop app.");
    return bridge;
}
