import { app, BrowserWindow, dialog, ipcMain, powerMonitor, safeStorage, systemPreferences } from "electron";
import type { IpcMainEvent, IpcMainInvokeEvent } from "electron";
import path from "node:path";
import { COSMOS_CONSTANTS, createWalletFromMnemonic, generateWallet, isValidMnemonic } from "@block52/poker-vm-sdk";
import { WalletVault } from "./vault";
import { WalletSigner } from "./signer";
import type { SignerNetwork, WalletCredential, WalletStatus } from "./types";

const MINUTE_MS = 60_000;
const REVEAL_GRANT_MS = 60_000;
const SEED_WORDS = 24;

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
    let revealGrantedUntil = 0;

    const confirmInNativeDialog = async (title: string, detail: string): Promise<boolean> => {
        const options = { type: "question" as const, buttons: ["Cancel", "Confirm"], defaultId: 0, cancelId: 0, message: title, detail, noLink: true };
        const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
        const result = parent !== undefined ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options);
        return result.response === 1;
    };

    const signer = new WalletSigner({ readMnemonic: () => vault.getMnemonic(), confirm: confirmInNativeDialog });

    const trusted = (event: IpcMainEvent | IpcMainInvokeEvent): boolean => {
        const sender = BrowserWindow.fromWebContents(event.sender);
        return sender !== null && event.senderFrame === event.sender.mainFrame;
    };

    const status = async (): Promise<WalletStatus> => ({ ...(await vault.status()), touchIdAvailable: touchIdAvailable() });

    const lockNow = () => {
        vault.lock();
        signer.reset();
        revealGrantedUntil = 0;
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
        const confirmed =
            "password" in credential
                ? await vault.verifyPassword(credential.password)
                : (await vault.status()).touchIdEnabled && (await confirmTouchId("Reveal your Block52 seed phrase"));
        if (confirmed) revealGrantedUntil = Date.now() + REVEAL_GRANT_MS;
        return confirmed;
    });

    handle("wallet:lock", async () => lockNow());

    handle("wallet:get-address", () => signer.address());

    handle("wallet:generate", async () => {
        const created = await generateWallet(COSMOS_CONSTANTS.ADDRESS_PREFIX, SEED_WORDS);
        await vault.saveMnemonic(created.mnemonic);
        signer.reset();
        return { mnemonic: created.mnemonic, address: created.address };
    });

    handle("wallet:import", async (mnemonic: unknown) => {
        if (typeof mnemonic !== "string" || !isValidMnemonic(mnemonic.trim())) throw new Error("Invalid seed phrase. Must be 12, 15, 18, 21, or 24 words.");
        const imported = await createWalletFromMnemonic(mnemonic.trim(), COSMOS_CONSTANTS.ADDRESS_PREFIX);
        await vault.saveMnemonic(mnemonic.trim());
        signer.reset();
        return imported.address;
    });

    handle("wallet:reveal-mnemonic", async () => {
        const protectedByPassword = (await vault.status()).hasPassword;
        if (protectedByPassword) {
            if (Date.now() > revealGrantedUntil) throw new Error("Confirm your password first.");
        } else if (!(await confirmInNativeDialog("Show your seed phrase?", "Anyone who sees it can take your funds."))) {
            throw new Error("Cancelled.");
        }
        return vault.getMnemonic();
    });

    handle("wallet:sign-query", (timestamp: unknown) => {
        if (typeof timestamp !== "number") throw new Error("Invalid timestamp.");
        return signer.signQuery(timestamp);
    });

    handle("wallet:signing-call", (network: unknown, method: unknown, args: unknown) => {
        const endpoints = network as Partial<SignerNetwork> | null;
        if (typeof endpoints !== "object" || endpoints === null || typeof endpoints.rpc !== "string" || typeof endpoints.rest !== "string") {
            throw new Error("Invalid network.");
        }
        return signer.call({ rpc: endpoints.rpc, rest: endpoints.rest }, method, Array.isArray(args) ? args : []);
    });

    handle("wallet:reset-signer", async () => signer.reset());

    handle("wallet:clear", async () => {
        signer.reset();
        await vault.clear();
    });

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
