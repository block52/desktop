import type { WalletBridge } from "./wallet/types";
import type { UpdateInfo } from "./updates/updateCheck";

declare global {
    interface Window {
        /** Exposed by the preload script; absent when the renderer runs in a plain browser. */
        electronAPI?: {
            openExternal: (url: string) => void;
            platform?: string;
            wallet: WalletBridge;
            menu?: {
                /** The window menu asked to open a screen. Returns an unsubscribe function. */
                onNavigate: (listener: (route: string) => void) => () => void;
            };
            updates?: {
                check: () => Promise<UpdateInfo | null>;
                open: (version: string) => void;
            };
        };
    }
}
