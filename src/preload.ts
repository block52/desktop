import { contextBridge, ipcRenderer } from "electron";
import type { WalletBridge } from "./wallet/types";
import type { UpdateInfo } from "./updates/updateCheck";

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
    signingCall: (network, method, args) => ipcRenderer.invoke("wallet:signing-call", network, method, args),
    resetSigner: () => ipcRenderer.invoke("wallet:reset-signer"),
    clear: () => ipcRenderer.invoke("wallet:clear"),
    setPassword: password => ipcRenderer.invoke("wallet:set-password", password),
    changePassword: (current, next) => ipcRenderer.invoke("wallet:change-password", current, next),
    removePassword: current => ipcRenderer.invoke("wallet:remove-password", current),
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
    updates: {
        check: (): Promise<UpdateInfo | null> => ipcRenderer.invoke("update:check"),
        open: (version: string) => ipcRenderer.send("update:open", version),
    },
});
