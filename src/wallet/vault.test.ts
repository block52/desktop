import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WalletVault } from "./vault";
import type { OsKeyStore } from "./vault";
import type { PgpTool } from "./pgp";

const MNEMONIC = "alpha bravo charlie delta echo foxtrot golf hotel india juliett kilo lima";

// Reversible stand-in for the OS keychain.
const fakeKeychain: OsKeyStore = {
    isSecure: () => true,
    encrypt: plain => Buffer.from(`keychain:${plain}`, "utf8"),
    decrypt: cipher => cipher.toString("utf8").replace("keychain:", ""),
};

// Stand-in for gpg: "encrypting" tags the plaintext, and only the matching tag decrypts.
const fakePgp: PgpTool = {
    isAvailable: async () => true,
    encryptTo: async (publicKey, plaintext) => ({ fingerprint: "ABCD".repeat(10), armored: `pgp:${publicKey}:${plaintext}` }),
    decrypt: async armored => armored.split(":")[2],
};

let dir: string;
let filePath: string;
let clock = 1_000_000;

function newVault(): WalletVault {
    return new WalletVault({ filePath, osKeys: fakeKeychain, scryptCost: 1024, now: () => clock, pgp: fakePgp });
}

beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "vault-"));
    filePath = path.join(dir, "wallet-vault.json");
});

afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
});

describe("WalletVault", () => {
    it("never writes the seed phrase to disk in the clear", async () => {
        const vault = newVault();
        await vault.saveMnemonic(MNEMONIC);

        const raw = await readFile(filePath, "utf8");
        expect(raw).not.toContain("alpha");
        expect(raw).not.toContain("bravo");
    });

    it("reopens a passwordless wallet through the keychain after a restart", async () => {
        await newVault().saveMnemonic(MNEMONIC);

        const restarted = newVault();
        await restarted.openWithKeychainIfPasswordless();
        expect(await restarted.getMnemonic()).toBe(MNEMONIC);
    });

    it("keeps a passworded wallet locked after a restart until the password is given", async () => {
        const vault = newVault();
        await vault.saveMnemonic(MNEMONIC);
        await vault.setPassword("correct horse");

        const restarted = newVault();
        await restarted.openWithKeychainIfPasswordless();
        expect((await restarted.status()).locked).toBe(true);
        await expect(restarted.getMnemonic()).rejects.toThrow("locked");

        expect(await restarted.unlockWithPassword("wrong password")).toBe(false);
        expect(await restarted.unlockWithPassword("correct horse")).toBe(true);
        expect(await restarted.getMnemonic()).toBe(MNEMONIC);
    });

    it("removes the keychain copy of the key when a password is set, so the keychain alone cannot open it", async () => {
        const vault = newVault();
        await vault.saveMnemonic(MNEMONIC);
        await vault.setPassword("correct horse");

        expect(JSON.parse(await readFile(filePath, "utf8")).osKey).toBeNull();
        expect(await newVault().unlockWithKeychain()).toBe(false);
    });

    it("lets Touch ID reopen the wallet through the keychain once enabled", async () => {
        const vault = newVault();
        await vault.saveMnemonic(MNEMONIC);
        await vault.setPassword("correct horse");
        await vault.setTouchId(true);

        const restarted = newVault();
        expect(await restarted.unlockWithKeychain()).toBe(true);
        expect(await restarted.getMnemonic()).toBe(MNEMONIC);
    });

    it("refuses Touch ID without a password", async () => {
        const vault = newVault();
        await vault.saveMnemonic(MNEMONIC);

        await expect(vault.setTouchId(true)).rejects.toThrow("password");
    });

    it("changes and removes the password only with the current one", async () => {
        const vault = newVault();
        await vault.saveMnemonic(MNEMONIC);
        await vault.setPassword("correct horse");

        await expect(vault.changePassword("nope nope nope", "another pass")).rejects.toThrow("incorrect");
        await vault.changePassword("correct horse", "another pass");
        expect(await newVault().unlockWithPassword("another pass")).toBe(true);

        await expect(vault.removePassword("correct horse")).rejects.toThrow("incorrect");
        await vault.removePassword("another pass");
        const restarted = newVault();
        await restarted.openWithKeychainIfPasswordless();
        expect(await restarted.getMnemonic()).toBe(MNEMONIC);
    });

    it("rejects short passwords", async () => {
        const vault = newVault();
        await vault.saveMnemonic(MNEMONIC);

        await expect(vault.setPassword("short")).rejects.toThrow("at least");
    });

    it("slows down guessing after repeated wrong passwords", async () => {
        const vault = newVault();
        await vault.saveMnemonic(MNEMONIC);
        await vault.setPassword("correct horse");
        vault.lock();

        for (let i = 0; i < 5; i += 1) expect(await vault.unlockWithPassword("wrong guess")).toBe(false);
        await expect(vault.unlockWithPassword("correct horse")).rejects.toThrow("Too many attempts");

        clock += 60_000;
        expect(await vault.unlockWithPassword("correct horse")).toBe(true);
    });

    it("replaces the seed under the same key, keeping the password", async () => {
        const vault = newVault();
        await vault.saveMnemonic(MNEMONIC);
        await vault.setPassword("correct horse");
        await vault.saveMnemonic("zulu yankee xray whiskey victor uniform tango sierra romeo quebec papa oscar");

        const restarted = newVault();
        expect(await restarted.unlockWithPassword("correct horse")).toBe(true);
        expect(await restarted.getMnemonic()).toContain("zulu yankee");
    });

    it("deletes everything on clear", async () => {
        const vault = newVault();
        await vault.saveMnemonic(MNEMONIC);
        await vault.clear();

        expect((await newVault().status()).exists).toBe(false);
        expect(await vault.getMnemonic()).toBeNull();
    });

    it("refuses to read the seed while locked", async () => {
        const vault = newVault();
        await vault.saveMnemonic(MNEMONIC);
        vault.lock();

        await expect(vault.getMnemonic()).rejects.toThrow("locked");
    });

    it("opens with a PGP key after a restart, and the key is not stored in the clear", async () => {
        const first = newVault();
        await first.saveMnemonic(MNEMONIC);
        await first.setPgpKey("PUBKEY");
        const raw = await readFile(filePath, "utf8");

        const second = newVault();
        expect((await second.status()).pgpFingerprint).toBe("ABCD".repeat(10));
        await second.openWithKeychainIfPasswordless();
        expect((await second.status()).locked).toBe(true);
        expect(await second.unlockWithPgp()).toBe(true);
        expect(await second.getMnemonic()).toBe(MNEMONIC);
        expect(raw).not.toContain("alpha");
    });

    it("keeps the password working alongside the PGP key", async () => {
        const first = newVault();
        await first.saveMnemonic(MNEMONIC);
        await first.setPassword("correct horse");
        await first.setPgpKey("PUBKEY");

        const viaPassword = newVault();
        expect(await viaPassword.unlockWithPassword("correct horse")).toBe(true);
        const viaPgp = newVault();
        expect(await viaPgp.unlockWithPgp()).toBe(true);
        expect(await viaPgp.getMnemonic()).toBe(MNEMONIC);
    });

    it("refuses a PGP unlock that returns the wrong key", async () => {
        const first = newVault();
        await first.saveMnemonic(MNEMONIC);
        await first.setPgpKey("PUBKEY");
        const other = new WalletVault({ filePath, osKeys: fakeKeychain, scryptCost: 1024, now: () => clock, pgp: { ...fakePgp, decrypt: async () => "cd".repeat(32) } });
        expect(await other.unlockWithPgp()).toBe(false);
        expect((await other.status()).locked).toBe(true);
    });

    it("goes back to the keychain when the PGP key is removed from a passwordless wallet", async () => {
        const first = newVault();
        await first.saveMnemonic(MNEMONIC);
        await first.setPgpKey("PUBKEY");
        await first.removePgpKey();

        const second = newVault();
        await second.openWithKeychainIfPasswordless();
        expect((await second.status()).locked).toBe(false);
        expect((await second.status()).pgpFingerprint).toBeNull();
    });

    it("keeps PGP as the way in when the password is removed", async () => {
        const first = newVault();
        await first.saveMnemonic(MNEMONIC);
        await first.setPassword("correct horse");
        await first.setPgpKey("PUBKEY");
        await first.removePassword("correct horse");

        const second = newVault();
        await second.openWithKeychainIfPasswordless();
        expect((await second.status()).locked).toBe(true);
        expect(await second.unlockWithPgp()).toBe(true);
    });

    it("needs the wallet unlocked to add a PGP key", async () => {
        const first = newVault();
        await first.saveMnemonic(MNEMONIC);
        await first.setPassword("correct horse");
        const locked = newVault();
        await expect(locked.setPgpKey("PUBKEY")).rejects.toThrow(/locked/);
    });
});
