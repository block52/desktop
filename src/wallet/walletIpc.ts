import { app, BrowserWindow, ipcMain, powerMonitor, safeStorage, systemPreferences } from "electron";
import type { IpcMainEvent, IpcMainInvokeEvent } from "electron";
import path from "node:path";
import { WalletVault } from "./vault";
import type { WalletCredential, WalletStatus } from "./types";

const MINUTE_MS = 60_000;

function touchIdAvailable(): boolean {
    return process.platform === "darwin" && systemPreferences.canPromptTouchID();
}

async function confirmTouchId(reason: string): Promise<boolean> {
    if (!touchIdAvailable()) return false;
    try {
        await systemPreferences.promptTouchID(reason);
        return true;
    } catch {
        return false;
    }
}

function osKeyStore() {
    return {
        isSecure: () => {
            if (!safeStorage.isEncryptionAvailable()) return false;
            return process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text";
        },
        encrypt: (plain: string) => safeStorage.encryptString(plain),
        decrypt: (cipher: Buffer) => safeStorage.decryptString(cipher),
    };
}

function isCredential(value: unknown): value is WalletCredential {
    if (typeof value !== "object" || value === null) return false;
    if ("touchId" in value) return value.touchId === true;
    return "password" in value && typeof value.password === "string";
}

/**
 * The wallet lives in the main process. The page asks for it over IPC and can only do what is exposed
 * here; Touch ID and the password checks run on this side.
 */
export function registerWalletIpc(): void {
    const vault = new WalletVault({ filePath: path.join(app.getPath("userData"), "wallet-vault.json"), osKeys: osKeyStore() });
    let autoLockTimer: NodeJS.Timeout | null = null;

    const trusted = (event: IpcMainEvent | IpcMainInvokeEvent): boolean => {
        const sender = BrowserWindow.fromWebContents(event.sender);
        return sender !== null && event.senderFrame === event.sender.mainFrame;
    };

    const status = async (): Promise<WalletStatus> => ({ ...(await vault.status()), touchIdAvailable: touchIdAvailable() });

    const lockNow = () => {
        vault.lock();
        if (autoLockTimer !== null) clearTimeout(autoLockTimer);
        autoLockTimer = null;
        for (const window of BrowserWindow.getAllWindows()) window.webContents.send("wallet:locked");
    };

    const armAutoLock = async () => {
        if (autoLockTimer !== null) clearTimeout(autoLockTimer);
        autoLockTimer = null;
        const current = await vault.status();
        if (!current.exists || current.locked || !current.hasPassword || current.autoLockMinutes === 0) return;
        autoLockTimer = setTimeout(lockNow, current.autoLockMinutes * MINUTE_MS);
    };

    const handle = <Args extends unknown[], Result>(channel: string, run: (...args: Args) => Promise<Result>) => {
        ipcMain.handle(channel, async (event, ...args) => {
            if (!trusted(event)) throw new Error("Untrusted caller.");
            return run(...(args as Args));
        });
    };

    handle("wallet:status", async () => {
        await vault.openWithKeychainIfPasswordless();
        return status();
    });

    handle("wallet:unlock", async (credential: unknown) => {
        if (!isCredential(credential)) return false;
        const unlocked =
            "password" in credential ? await vault.unlockWithPassword(credential.password) : (await confirmTouchId("Unlock your Block52 wallet")) && (await vault.unlockWithKeychain());
        if (unlocked) await armAutoLock();
        return unlocked;
    });

    handle("wallet:authenticate", async (credential: unknown) => {
        if (!isCredential(credential)) return false;
        if ("password" in credential) return vault.verifyPassword(credential.password);
        return (await vault.status()).touchIdEnabled && (await confirmTouchId("Reveal your Block52 seed phrase"));
    });

    handle("wallet:lock", async () => lockNow());
    handle("wallet:get-mnemonic", () => vault.getMnemonic());

    handle("wallet:save-mnemonic", async (mnemonic: unknown) => {
        if (typeof mnemonic !== "string" || mnemonic.trim() === "") throw new Error("Invalid seed phrase.");
        await vault.saveMnemonic(mnemonic);
    });

    handle("wallet:clear", () => vault.clear());

    handle("wallet:set-password", async (password: unknown) => {
        if (typeof password !== "string") throw new Error("Invalid password.");
        await vault.setPassword(password);
        await armAutoLock();
    });

    handle("wallet:change-password", async (current: unknown, next: unknown) => {
        if (typeof current !== "string" || typeof next !== "string") throw new Error("Invalid password.");
        await vault.changePassword(current, next);
    });

    handle("wallet:remove-password", async (current: unknown) => {
        if (typeof current !== "string") throw new Error("Invalid password.");
        await vault.removePassword(current);
        await armAutoLock();
    });

    handle("wallet:set-touch-id", async (enabled: unknown) => {
        if (typeof enabled !== "boolean") throw new Error("Invalid value.");
        if (enabled && !touchIdAvailable()) throw new Error("Touch ID is not available on this Mac.");
        await vault.setTouchId(enabled);
    });

    handle("wallet:set-auto-lock", async (minutes: unknown) => {
        if (typeof minutes !== "number") throw new Error("Invalid value.");
        await vault.setAutoLock(minutes);
        await armAutoLock();
    });

    ipcMain.on("wallet:activity", event => {
        if (trusted(event)) void armAutoLock();
    });

    // Lock when the screen locks or the machine sleeps. A wallet without a password has nothing to ask for, so it stays open.
    const lockIfProtected = async () => {
        if ((await vault.status()).hasPassword) lockNow();
    };
    powerMonitor.on("lock-screen", () => void lockIfProtected());
    powerMonitor.on("suspend", () => void lockIfProtected());
}
