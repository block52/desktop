import type { WalletBridge } from "./wallet/types";
import type { UpdateInfo } from "./updates/updateCheck";

declare global {
    interface Window {
        /** Exposed by the preload script; absent when the renderer runs in a plain browser. */
        electronAPI?: {
            openExternal: (url: string) => void;
            platform?: string;
            wallet: WalletBridge;
            updates?: {
                check: () => Promise<UpdateInfo | null>;
                open: (version: string) => void;
            };
        };
    }
}
