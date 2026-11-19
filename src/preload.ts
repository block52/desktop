import { contextBridge, ipcRenderer } from "electron";
import type { WalletBridge } from "./wallet/types";
import type { UpdateInfo } from "./updates/updateCheck";
import type { HandSearchResult } from "./indexer/handSearch";

const wallet: WalletBridge = {
    status: () => ipcRenderer.invoke("wallet:status"),
    unlock: credential => ipcRenderer.invoke("wallet:unlock", credential),
    authenticate: credential => ipcRenderer.invoke("wallet:authenticate", credential),
    lock: () => ipcRenderer.invoke("wallet:lock"),
    getAddress: () => ipcRenderer.invoke("wallet:get-address"),
    generate: () => ipcRenderer.invoke("wallet:generate"),
    importMnemonic: mnemonic => ipcRenderer.invoke("wallet:import", mnemonic),
    revealMnemonic: () => ipcRenderer.invoke("wallet:reveal-mnemonic"),
    signQuery: timestamp => ipcRenderer.invoke("wallet:sign-query", timestamp),
    broadcastAction: (grpc, chainId, params) => ipcRenderer.invoke("wallet:broadcast-action", grpc, chainId, params),
    signingCall: (network, method, args) => ipcRenderer.invoke("wallet:signing-call", network, method, args),
    resetSigner: () => ipcRenderer.invoke("wallet:reset-signer"),
    ethAddress: () => ipcRenderer.invoke("wallet:eth-address"),
    ethBalances: () => ipcRenderer.invoke("wallet:eth-balances"),
    ethDeposit: (token, amount) => ipcRenderer.invoke("wallet:eth-deposit", token, amount),
    clear: () => ipcRenderer.invoke("wallet:clear"),
    setPassword: password => ipcRenderer.invoke("wallet:set-password", password),
    changePassword: (current, next) => ipcRenderer.invoke("wallet:change-password", current, next),
    removePassword: current => ipcRenderer.invoke("wallet:remove-password", current),
    setPgpKey: publicKey => ipcRenderer.invoke("wallet:set-pgp-key", publicKey),
    removePgpKey: () => ipcRenderer.invoke("wallet:remove-pgp-key"),
    setTouchId: enabled => ipcRenderer.invoke("wallet:set-touch-id", enabled),
    setAutoLock: minutes => ipcRenderer.invoke("wallet:set-auto-lock", minutes),
    reportActivity: () => ipcRenderer.send("wallet:activity"),
    onLocked: listener => {
        const handler = () => listener();
        ipcRenderer.on("wallet:locked", handler);
        return () => ipcRenderer.removeListener("wallet:locked", handler);
    },
};

contextBridge.exposeInMainWorld("electronAPI", {
    openExternal: (url: string) => ipcRenderer.send("open-external", url),
    platform: process.platform,
    wallet,
    menu: {
        onNavigate: (listener: (route: string) => void) => {
            const handler = (_event: unknown, route: unknown) => {
                if (typeof route === "string") listener(route);
            };
            ipcRenderer.on("menu:navigate", handler);
            return () => ipcRenderer.removeListener("menu:navigate", handler);
        },
    },
    updates: {
        check: (): Promise<UpdateInfo | null> => ipcRenderer.invoke("update:check"),
        open: (version: string) => ipcRenderer.send("update:open", version),
    },
    indexer: {
        isSearchAvailable: (): Promise<boolean> => ipcRenderer.invoke("indexer:search-available"),
        searchHands: (text: string, limit: number, offset: number): Promise<HandSearchResult> =>
            ipcRenderer.invoke("indexer:search-hands", text, limit, offset),
    },
});
