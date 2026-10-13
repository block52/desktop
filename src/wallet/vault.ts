import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { VaultStatus } from "./types";

/** The OS keychain (Electron `safeStorage`), injected so the vault can be tested without Electron. */
export interface OsKeyStore {
    /** False when the OS only offers obfuscation (Linux without a keyring), so the key is not really protected. */
    isSecure: () => boolean;
    encrypt: (plain: string) => Buffer;
    decrypt: (cipher: Buffer) => string;
}

interface Sealed {
    iv: string;
    tag: string;
    data: string;
}

interface VaultFile {
    version: 1;
    /** The seed phrase, AES-256-GCM under the vault key. */
    seed: Sealed;
    /** The vault key sealed by the OS keychain. Absent when only the password can open the vault. */
    osKey: string | null;
    /** The vault key sealed by a key derived from the password. */
    passwordKey: (Sealed & { salt: string }) | null;
    touchId: boolean;
    autoLockMinutes: number;
}

interface VaultOptions {
    filePath: string;
    osKeys: OsKeyStore;
    /** scrypt cost; tests lower it. */
    scryptCost?: number;
    now?: () => number;
}

const VAULT_KEY_BYTES = 32;
const SCRYPT_COST = 32768;
const SCRYPT_MAX_MEM = 128 * 1024 * 1024;
const MIN_PASSWORD_LENGTH = 8;
const FREE_ATTEMPTS = 5;
const ATTEMPT_DELAY_MS = 5000;
const DEFAULT_AUTO_LOCK_MINUTES = 15;

function seal(key: Buffer, plain: Buffer): Sealed {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([cipher.update(plain), cipher.final()]);
    return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

function open(key: Buffer, sealed: Sealed): Buffer {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
    decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(sealed.data, "base64")), decipher.final()]);
}

function deriveKey(password: string, salt: Buffer, cost: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        scrypt(password.normalize("NFKC"), salt, VAULT_KEY_BYTES, { N: cost, r: 8, p: 1, maxmem: SCRYPT_MAX_MEM }, (error, key) => {
            if (error !== null) reject(error);
            else resolve(key);
        });
    });
}

function isVaultFile(value: unknown): value is VaultFile {
    if (typeof value !== "object" || value === null) return false;
    return "version" in value && value.version === 1 && "seed" in value && typeof value.seed === "object";
}

/**
 * Holds the wallet seed phrase encrypted at rest.
 *
 * The seed is sealed with a random vault key. That key is kept by the OS keychain (unlocks without
 * asking) and/or wrapped by a key derived from the user's password. With a password and no Touch ID the
 * keychain copy is removed, so the password is the only way in.
 */
export class WalletVault {
    private readonly filePath: string;
    private readonly osKeys: OsKeyStore;
    private readonly cost: number;
    private readonly now: () => number;
    private file: VaultFile | null = null;
    private loaded = false;
    private vaultKey: Buffer | null = null;
    private failedAttempts = 0;
    private blockedUntil = 0;

    constructor(options: VaultOptions) {
        this.filePath = options.filePath;
        this.osKeys = options.osKeys;
        this.cost = options.scryptCost ?? SCRYPT_COST;
        this.now = options.now ?? Date.now;
    }

    async status(): Promise<VaultStatus> {
        const file = await this.read();
        if (file === null) {
            return { exists: false, locked: false, hasPassword: false, touchIdEnabled: false, autoLockMinutes: DEFAULT_AUTO_LOCK_MINUTES, osProtected: this.osKeys.isSecure() };
        }
        return {
            exists: true,
            locked: this.vaultKey === null,
            hasPassword: file.passwordKey !== null,
            touchIdEnabled: file.touchId,
            autoLockMinutes: file.autoLockMinutes,
            osProtected: this.osKeys.isSecure(),
        };
    }

    /** A vault without a password opens with the OS keychain alone, so it is unlocked as soon as the app starts. */
    async openWithKeychainIfPasswordless(): Promise<void> {
        const file = await this.read();
        if (file === null || file.passwordKey !== null || file.osKey === null || this.vaultKey !== null) return;
        this.vaultKey = this.unsealOsKey(file.osKey);
    }

    /** For Touch ID: the caller has already verified the fingerprint. */
    async unlockWithKeychain(): Promise<boolean> {
        const file = await this.read();
        if (file === null || !file.touchId || file.osKey === null) return false;
        this.vaultKey = this.unsealOsKey(file.osKey);
        return true;
    }

    async unlockWithPassword(password: string): Promise<boolean> {
        const key = await this.keyFromPassword(password);
        if (key === null) return false;
        this.vaultKey = key;
        return true;
    }

    /** Checks the password without changing whether the vault is locked. */
    async verifyPassword(password: string): Promise<boolean> {
        return (await this.keyFromPassword(password)) !== null;
    }

    lock(): void {
        this.vaultKey = null;
    }

    async getMnemonic(): Promise<string | null> {
        const file = await this.read();
        if (file === null) return null;
        const key = this.requireKey();
        return open(key, file.seed).toString("utf8");
    }

    async saveMnemonic(mnemonic: string): Promise<void> {
        const file = await this.read();
        if (file === null) {
            const key = randomBytes(VAULT_KEY_BYTES);
            this.vaultKey = key;
            await this.write({
                version: 1,
                seed: seal(key, Buffer.from(mnemonic, "utf8")),
                osKey: this.sealOsKey(key),
                passwordKey: null,
                touchId: false,
                autoLockMinutes: DEFAULT_AUTO_LOCK_MINUTES,
            });
            return;
        }
        const key = this.requireKey();
        await this.write({ ...file, seed: seal(key, Buffer.from(mnemonic, "utf8")) });
    }

    async setPassword(password: string): Promise<void> {
        this.assertPasswordStrength(password);
        const file = await this.requireFile();
        const key = this.requireKey();
        await this.write({ ...file, passwordKey: await this.wrapWithPassword(key, password), osKey: file.touchId ? file.osKey : null });
    }

    async changePassword(current: string, next: string): Promise<void> {
        this.assertPasswordStrength(next);
        if (!(await this.verifyPassword(current))) throw new Error("Current password is incorrect.");
        await this.setPassword(next);
    }

    async removePassword(current: string): Promise<void> {
        if (!(await this.verifyPassword(current))) throw new Error("Current password is incorrect.");
        const file = await this.requireFile();
        const key = this.requireKey();
        await this.write({ ...file, passwordKey: null, touchId: false, osKey: this.sealOsKey(key) });
    }

    async setTouchId(enabled: boolean): Promise<void> {
        const file = await this.requireFile();
        const key = this.requireKey();
        if (file.passwordKey === null) throw new Error("Set a password before turning on Touch ID.");
        await this.write({ ...file, touchId: enabled, osKey: enabled ? this.sealOsKey(key) : null });
    }

    async setAutoLock(minutes: number): Promise<void> {
        const file = await this.requireFile();
        if (!Number.isInteger(minutes) || minutes < 0 || minutes > 24 * 60) throw new Error("Invalid auto-lock time.");
        await this.write({ ...file, autoLockMinutes: minutes });
    }

    async clear(): Promise<void> {
        this.vaultKey = null;
        this.file = null;
        this.loaded = true;
        await fs.rm(this.filePath, { force: true });
    }

    private async keyFromPassword(password: string): Promise<Buffer | null> {
        const file = await this.read();
        if (file === null || file.passwordKey === null) return null;
        if (this.now() < this.blockedUntil) {
            const seconds = Math.ceil((this.blockedUntil - this.now()) / 1000);
            throw new Error(`Too many attempts. Try again in ${seconds} seconds.`);
        }
        const wrapped = file.passwordKey;
        const derived = await deriveKey(password, Buffer.from(wrapped.salt, "base64"), this.cost);
        try {
            const key = open(derived, wrapped);
            if (key.length !== VAULT_KEY_BYTES) return null;
            this.failedAttempts = 0;
            return key;
        } catch {
            this.failedAttempts += 1;
            if (this.failedAttempts >= FREE_ATTEMPTS) {
                this.blockedUntil = this.now() + ATTEMPT_DELAY_MS * (this.failedAttempts - FREE_ATTEMPTS + 1);
            }
            return null;
        }
    }

    private async wrapWithPassword(key: Buffer, password: string): Promise<VaultFile["passwordKey"]> {
        const salt = randomBytes(16);
        const derived = await deriveKey(password, salt, this.cost);
        return { salt: salt.toString("base64"), ...seal(derived, key) };
    }

    private assertPasswordStrength(password: string): void {
        if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    private sealOsKey(key: Buffer): string {
        return this.osKeys.encrypt(key.toString("hex")).toString("base64");
    }

    private unsealOsKey(sealed: string): Buffer {
        const key = Buffer.from(this.osKeys.decrypt(Buffer.from(sealed, "base64")), "hex");
        if (key.length !== VAULT_KEY_BYTES) throw new Error("The wallet key could not be read from the OS keychain.");
        return key;
    }

    private requireKey(): Buffer {
        if (this.vaultKey === null) throw new Error("Wallet is locked.");
        return this.vaultKey;
    }

    private async requireFile(): Promise<VaultFile> {
        const file = await this.read();
        if (file === null) throw new Error("No wallet saved.");
        return file;
    }

    private async read(): Promise<VaultFile | null> {
        if (this.loaded) return this.file;
        try {
            const parsed: unknown = JSON.parse(await fs.readFile(this.filePath, "utf8"));
            if (!isVaultFile(parsed)) throw new Error("The wallet file is not in a format this version understands.");
            this.file = parsed;
        } catch (error) {
            if (error instanceof Error && "code" in error && error.code === "ENOENT") this.file = null;
            else throw error;
        }
        this.loaded = true;
        return this.file;
    }

    private async write(file: VaultFile): Promise<void> {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        const temp = `${this.filePath}.tmp`;
        await fs.writeFile(temp, JSON.stringify(file), { mode: 0o600 });
        await fs.rename(temp, this.filePath);
        this.file = file;
        this.loaded = true;
    }
}
