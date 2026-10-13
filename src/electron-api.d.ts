import type { WalletBridge } from "./wallet/types";

declare global {
    interface Window {
        /** Exposed by the preload script; absent when the renderer runs in a plain browser. */
        electronAPI?: {
            openExternal: (url: string) => void;
            wallet: WalletBridge;
        };
    }
}
