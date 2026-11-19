import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const GPG = "gpg";
const QUICK_TIMEOUT_MS = 15_000;
/** Unlocking waits for the user to type a passphrase or touch a hardware key. */
const DECRYPT_TIMEOUT_MS = 120_000;
const FINGERPRINT = /^[0-9A-F]{40}$|^[0-9A-F]{64}$/;
const MAX_KEY_CHARS = 200_000;

/** The PGP operations the vault needs, so it can be tested without gpg installed. */
export interface PgpTool {
    isAvailable: () => Promise<boolean>;
    /** Encrypts to a public key. Throws for anything that is not exactly one public key. */
    encryptTo: (publicKey: string, plaintext: string) => Promise<{ fingerprint: string; armored: string }>;
    /** Decrypts with the user's own gpg, which asks for the passphrase or hardware key itself. */
    decrypt: (armored: string) => Promise<string>;
}

interface GpgResult {
    code: number;
    stdout: string;
    stderr: string;
}

export type GpgRunner = (args: string[], input: string, timeoutMs: number) => Promise<GpgResult>;

export const runGpg: GpgRunner = (args, input, timeoutMs) =>
    new Promise((resolve, reject) => {
        const child = spawn(GPG, args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error("gpg took too long."));
        }, timeoutMs);
        child.stdout.setEncoding("utf8").on("data", chunk => (stdout += chunk));
        child.stderr.setEncoding("utf8").on("data", chunk => (stderr += chunk));
        child.on("error", error => {
            clearTimeout(timer);
            reject("code" in error && error.code === "ENOENT" ? new Error("gpg was not found. Install GnuPG to use a PGP key.") : error);
        });
        child.on("close", code => {
            clearTimeout(timer);
            resolve({ code: code ?? 1, stdout, stderr });
        });
        child.stdin.on("error", () => undefined);
        child.stdin.end(input);
    });

/** The primary key's fingerprint, and a refusal for a private key, several keys, or nothing usable. */
export function fingerprintOf(colonListing: string): string {
    const lines = colonListing.split("\n");
    if (lines.some(line => line.startsWith("sec:") || line.startsWith("ssb:"))) {
        throw new Error("That is a private key. Paste the public key only.");
    }
    const primaries = lines.filter(line => line.startsWith("pub:"));
    if (primaries.length !== 1) throw new Error("Paste exactly one PGP public key.");
    const index = lines.findIndex(line => line.startsWith("pub:"));
    const fingerprintLine = lines.slice(index + 1).find(line => line.startsWith("fpr:"));
    const fingerprint = fingerprintLine?.split(":")[9];
    if (fingerprint === undefined || !FINGERPRINT.test(fingerprint)) throw new Error("Could not read that PGP key.");
    return fingerprint;
}

const BASE = ["--batch", "--no-tty", "--quiet"];

export function createGpgTool(run: GpgRunner = runGpg): PgpTool {
    return {
        async isAvailable() {
            try {
                return (await run(["--version"], "", QUICK_TIMEOUT_MS)).code === 0;
            } catch {
                return false;
            }
        },

        async encryptTo(publicKey, plaintext) {
            if (publicKey.length === 0 || publicKey.length > MAX_KEY_CHARS || !publicKey.includes("BEGIN PGP PUBLIC KEY BLOCK")) {
                throw new Error("Paste an armored PGP public key (-----BEGIN PGP PUBLIC KEY BLOCK-----).");
            }
            // A throwaway keyring, so the pasted key never lands in the user's own and leaves nothing behind.
            const home = await mkdtemp(path.join(os.tmpdir(), "b52-gpg-"));
            const withHome = (...args: string[]) => ["--homedir", home, ...BASE, ...args];
            try {
                const listing = await run(withHome("--with-colons", "--import-options", "show-only", "--import"), publicKey, QUICK_TIMEOUT_MS);
                if (listing.code !== 0) throw new Error("Could not read that PGP key.");
                const fingerprint = fingerprintOf(listing.stdout);
                const imported = await run(withHome("--import"), publicKey, QUICK_TIMEOUT_MS);
                if (imported.code !== 0) throw new Error("Could not read that PGP key.");
                // The user chose this exact key, so there is no web of trust to consult.
                const encrypted = await run(withHome("--armor", "--trust-model", "always", "--encrypt", "--recipient", fingerprint), plaintext, QUICK_TIMEOUT_MS);
                if (encrypted.code !== 0 || !encrypted.stdout.includes("BEGIN PGP MESSAGE")) {
                    throw new Error("That key cannot encrypt (it may be expired, revoked or sign-only).");
                }
                return { fingerprint, armored: encrypted.stdout };
            } finally {
                await run(["--homedir", home, "--batch", "--kill", "gpg-agent"], "", QUICK_TIMEOUT_MS).catch(() => undefined);
                await rm(home, { recursive: true, force: true });
            }
        },

        async decrypt(armored) {
            const result = await run(["--batch", "--quiet", "--decrypt"], armored, DECRYPT_TIMEOUT_MS);
            if (result.code !== 0) throw new Error("gpg could not unlock the wallet key (wrong passphrase, key missing, or cancelled).");
            return result.stdout;
        },
    };
}
