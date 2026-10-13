import { contextBridge, ipcRenderer } from "electron";
import type { WalletBridge } from "./wallet/types";

const wallet: WalletBridge = {
    status: () => ipcRenderer.invoke("wallet:status"),
    unlock: credential => ipcRenderer.invoke("wallet:unlock", credential),
    authenticate: credential => ipcRenderer.invoke("wallet:authenticate", credential),
    lock: () => ipcRenderer.invoke("wallet:lock"),
    getMnemonic: () => ipcRenderer.invoke("wallet:get-mnemonic"),
    saveMnemonic: mnemonic => ipcRenderer.invoke("wallet:save-mnemonic", mnemonic),
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
    wallet,
});
