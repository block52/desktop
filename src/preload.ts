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
    players: {
        get: (address: string) => ipcRenderer.invoke("players:get", address),
        getMany: (addresses: string[]) => ipcRenderer.invoke("players:get-many", addresses),
        setNickname: (address: string, nickname: string | null) => ipcRenderer.invoke("players:set-nickname", address, nickname),
        setNotes: (address: string, notes: string | null) => ipcRenderer.invoke("players:set-notes", address, notes),
        addTag: (address: string, name: string) => ipcRenderer.invoke("players:add-tag", address, name),
        removeTag: (address: string, tagId: number) => ipcRenderer.invoke("players:remove-tag", address, tagId),
        listTags: () => ipcRenderer.invoke("players:list-tags"),
        renameTag: (id: number, name: string) => ipcRenderer.invoke("players:rename-tag", id, name),
        deleteTag: (id: number) => ipcRenderer.invoke("players:delete-tag", id),
        search: (text: string) => ipcRenderer.invoke("players:search", text),
        export: () => ipcRenderer.invoke("players:export"),
        import: (data: unknown) => ipcRenderer.invoke("players:import", data),
        deleteAll: () => ipcRenderer.invoke("players:delete-all"),
    },
});
