import { app, BrowserWindow, dialog, ipcMain, powerMonitor, safeStorage, systemPreferences } from "electron";
import type { IpcMainEvent, IpcMainInvokeEvent } from "electron";
import path from "node:path";
import { WalletVault } from "./vault";
import { WalletSigner } from "./signer";
import { WalletSidecar } from "./goSidecar";
import { createGpgTool } from "./pgp";
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

/** Locking only means something when something other than the OS keychain is needed to reopen. */
function isLockProtected(status: { hasPassword: boolean; pgpFingerprint: string | null }): boolean {
    return status.hasPassword || status.pgpFingerprint !== null;
}

function isCredential(value: unknown): value is WalletCredential {
    if (typeof value !== "object" || value === null) return false;
    if ("touchId" in value) return value.touchId === true;
    if ("pgp" in value) return value.pgp === true;
    return "password" in value && typeof value.password === "string";
}

/**
 * The wallet lives in the main process. The page asks for it over IPC and can only do what is exposed
 * here; Touch ID and the password checks run on this side.
 */
export function registerWalletIpc(): { lockWallet: () => void } {
    const pgp = createGpgTool();
    let pgpAvailable: boolean | null = null;
    const vault = new WalletVault({ filePath: path.join(app.getPath("userData"), "wallet-vault.json"), osKeys: osKeyStore(), pgp });
    let autoLockTimer: NodeJS.Timeout | null = null;
    let revealGrantedUntil = 0;

    const confirmInNativeDialog = async (title: string, detail: string): Promise<boolean> => {
        const options = { type: "question" as const, buttons: ["Cancel", "Confirm"], defaultId: 0, cancelId: 0, message: title, detail, noLink: true };
        const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
        const result = parent !== undefined ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options);
        return result.response === 1;
    };

    const sidecar = new WalletSidecar();
    // With the Go signer on (VITE_GO_SIGNER), sendTokens is signed in the sidecar. WalletSigner still asks the user in
    // a native dialog first; sending never goes through "wallet:broadcast-action", which has no such confirmation.
    const goSignerOn = import.meta.env.VITE_GO_SIGNER === "true";
    const signer = new WalletSigner({
        readMnemonic: () => vault.getMnemonic(),
        confirm: confirmInNativeDialog,
        sendTokensInGo: goSignerOn
            ? async request => (await sidecar.broadcast({ ...request, kind: "send", mnemonic: await requireMnemonic(), gameId: "" })).txHash
            : undefined,
    });

    const trusted = (event: IpcMainEvent | IpcMainInvokeEvent): boolean => {
        const sender = BrowserWindow.fromWebContents(event.sender);
        return sender !== null && event.senderFrame === event.sender.mainFrame;
    };

    const status = async (): Promise<WalletStatus> => {
        pgpAvailable ??= await pgp.isAvailable();
        return { ...(await vault.status()), touchIdAvailable: touchIdAvailable(), pgpAvailable };
    };

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
        if (!current.exists || current.locked || !isLockProtected(current) || current.autoLockMinutes === 0) return;
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
        let unlocked: boolean;
        if ("password" in credential) unlocked = await vault.unlockWithPassword(credential.password);
        else if ("pgp" in credential) unlocked = await vault.unlockWithPgp();
        else unlocked = (await confirmTouchId("Unlock your Block52 wallet")) && (await vault.unlockWithKeychain());
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

    // Pure wallet crypto — generate, derive the address, validate and the
    // table-query signature — runs in the Go sidecar (github.com/block52/pokerchain-go-client),
    // which matches the SDK/ethers output byte for byte. The sealed vault and
    // the OS keychain stay here; the sidecar only ever sees a mnemonic in memory.
    const requireMnemonic = async (): Promise<string> => {
        const mnemonic = await vault.getMnemonic();
        if (mnemonic === null) throw new Error("Block52 wallet not initialized. Please create or import a Block52 wallet first.");
        return mnemonic;
    };

    handle("wallet:get-address", async () => sidecar.address(await requireMnemonic()));

    handle("wallet:generate", async () => {
        const created = await sidecar.generate(SEED_WORDS === 24 ? 256 : 128);
        await vault.saveMnemonic(created.mnemonic);
        signer.reset();
        return created;
    });

    handle("wallet:import", async (mnemonic: unknown) => {
        if (typeof mnemonic !== "string" || !(await sidecar.validateMnemonic(mnemonic.trim()))) {
            throw new Error("Invalid seed phrase. Must be 12, 15, 18, 21, or 24 words.");
        }
        const trimmed = mnemonic.trim();
        const address = await sidecar.address(trimmed);
        await vault.saveMnemonic(trimmed);
        signer.reset();
        return address;
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

    // A game action (performAction / join / leave / topUp) signed and broadcast in Go the way the
    // SDK does it: actions unordered (performActionSync), join/leave/topUp ordered and confirmed
    // on-chain. Bank sends are not accepted here (see sendTokensInGo above); withdrawals stay on the SDK signer for now.
    handle("wallet:broadcast-action", async (grpc: unknown, chainId: unknown, params: unknown) => {
        if (typeof grpc !== "string" || typeof chainId !== "string") throw new Error("Invalid network.");
        if (typeof params !== "object" || params === null) throw new Error("Invalid action.");
        const p = params as Record<string, unknown>;
        const kind = p.kind;
        if (kind !== "action" && kind !== "join" && kind !== "leave" && kind !== "topUp") throw new Error("Invalid action kind.");
        return sidecar.broadcast({
            mnemonic: await requireMnemonic(),
            grpc,
            chainId,
            kind,
            gameId: String(p.gameId ?? ""),
            action: typeof p.action === "string" ? p.action : undefined,
            amount: typeof p.amount === "number" ? p.amount : undefined,
            data: typeof p.data === "string" ? p.data : undefined,
            seat: typeof p.seat === "number" ? p.seat : undefined,
            buyIn: typeof p.buyIn === "number" ? p.buyIn : undefined,
            finishingOrder: Array.isArray(p.finishingOrder) && p.finishingOrder.every(entry => typeof entry === "string") ? (p.finishingOrder as string[]) : undefined,
        });
    });

    handle("wallet:sign-query", async (timestamp: unknown) => {
        if (typeof timestamp !== "number") throw new Error("Invalid timestamp.");
        return sidecar.signQuery(await requireMnemonic(), timestamp);
    });

    handle("wallet:signing-call", (network: unknown, method: unknown, args: unknown) => {
        const endpoints = network as Partial<SignerNetwork> | null;
        if (typeof endpoints !== "object" || endpoints === null || typeof endpoints.rpc !== "string" || typeof endpoints.rest !== "string") {
            throw new Error("Invalid network.");
        }
        return signer.call(
            { rpc: endpoints.rpc, rest: endpoints.rest, ...(typeof endpoints.grpc === "string" ? { grpc: endpoints.grpc } : {}) },
            method,
            Array.isArray(args) ? args : []
        );
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

    handle("wallet:set-pgp-key", async (publicKey: unknown) => {
        if (typeof publicKey !== "string") throw new Error("Invalid key.");
        await vault.setPgpKey(publicKey.trim());
        await armAutoLock();
    });

    handle("wallet:remove-pgp-key", async () => {
        await vault.removePgpKey();
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
        if (isLockProtected(await vault.status())) lockNow();
    };
    powerMonitor.on("lock-screen", () => void lockIfProtected());
    powerMonitor.on("suspend", () => void lockIfProtected());

    return { lockWallet: lockNow };
}
