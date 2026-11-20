import type { WalletBridge } from "./wallet/types";
import type { UpdateInfo } from "./updates/updateCheck";
import type { HandSearchResult } from "./indexer/handSearch";
import type { PlayersBridge } from "./players/types";
import type { BinaryStatus } from "./binaries/binaryRelease";

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
            indexer?: {
                /** False when this build has no indexer API key, so GraphQL search cannot run. */
                isSearchAvailable: () => Promise<boolean>;
                /** Hands whose table id or a player's address contains `text`, through the indexer's GraphQL API. */
                searchHands: (text: string, limit: number, offset: number) => Promise<HandSearchResult>;
            };
            /** Local, private player notes/nicknames/tags (SQLite in the main process). */
            players?: PlayersBridge;
            /** Node binary (pokerchaind, ws-server) installed vs latest versions + update flag. */
            binaries?: {
                status: () => Promise<BinaryStatus[]>;
            };
        };
    }
}
