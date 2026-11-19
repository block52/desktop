import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGpgTool, fingerprintOf } from "./pgp";

const gpgInstalled = (() => {
    try {
        execFileSync("gpg", ["--version"], { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
})();

describe("fingerprintOf", () => {
    const FPR = "A".repeat(40);
    it("reads the fingerprint of a single public key", () => {
        expect(fingerprintOf(`pub:u:255:22:1234:1:::u:::scESC:\nfpr:::::::::${FPR}:\nuid:u::::1::X::a <a@b>:\n`)).toBe(FPR);
    });
    it("refuses a private key", () => {
        expect(() => fingerprintOf(`sec:u:255:22:1234:1:::u:::scESC:\nfpr:::::::::${FPR}:\n`)).toThrow(/private key/);
    });
    it("refuses several keys or none", () => {
        expect(() => fingerprintOf(`pub:u::\nfpr:::::::::${FPR}:\npub:u::\nfpr:::::::::${FPR}:\n`)).toThrow(/exactly one/);
        expect(() => fingerprintOf("")).toThrow(/exactly one/);
    });
});

describe.skipIf(!gpgInstalled)("createGpgTool with a real gpg", () => {
    let home: string;
    let publicKey: string;
    let previousHome: string | undefined;

    beforeAll(async () => {
        home = await mkdtemp(path.join(os.tmpdir(), "b52-gpgtest-"));
        previousHome = process.env.GNUPGHOME;
        process.env.GNUPGHOME = home;
        execFileSync("gpg", ["--batch", "--passphrase", "", "--quick-gen-key", "Test <test@example.com>", "default", "default", "never"], { stdio: "ignore" });
        publicKey = execFileSync("gpg", ["--armor", "--export", "Test"], { encoding: "utf8" });
    }, 60_000);

    afterAll(async () => {
        try {
            execFileSync("gpgconf", ["--kill", "gpg-agent"], { stdio: "ignore" });
        } catch {
            // best effort
        }
        if (previousHome === undefined) delete process.env.GNUPGHOME;
        else process.env.GNUPGHOME = previousHome;
        await rm(home, { recursive: true, force: true });
    });

    it("encrypts to a public key and decrypts with the owner's gpg", async () => {
        const tool = createGpgTool();
        const secret = "ab".repeat(32);
        const { fingerprint, armored } = await tool.encryptTo(publicKey, secret);
        expect(fingerprint).toMatch(/^[0-9A-F]{40}$/);
        expect(armored).toContain("BEGIN PGP MESSAGE");
        expect(armored).not.toContain(secret);
        expect((await tool.decrypt(armored)).trim()).toBe(secret);
    }, 60_000);

    it("refuses a private key and text that is not a key", async () => {
        const tool = createGpgTool();
        const privateKey = execFileSync("gpg", ["--armor", "--export-secret-keys", "Test"], { encoding: "utf8" });
        await expect(tool.encryptTo(privateKey, "x")).rejects.toThrow(/public key/);
        await expect(tool.encryptTo("hello", "x")).rejects.toThrow(/PGP public key/);
    }, 60_000);
});
