import { describe, expect, it, vi } from "vitest";
import { DEFAULT_KEY_SERVERS, findPgpKey, lookupUrl, normalizeKeyServer, parseKeyQuery } from "./pgpKeyServer";
import type { KeyServerDeps } from "./pgpKeyServer";

const FP = "F68AA906B5BE601AC49EF83DC61F975DEBDEDC6B";
const KEY = "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nabc\n-----END PGP PUBLIC KEY BLOCK-----\n";

function reply(status: number, body: string, url = "https://x.test/") {
    return { ok: status >= 200 && status < 300, status, url, text: async () => body };
}

function deps(fetchImpl: KeyServerDeps["fetch"], fingerprint = FP): KeyServerDeps {
    return { fetch: fetchImpl, fingerprintOf: vi.fn(async () => fingerprint) };
}

describe("parseKeyQuery", () => {
    it("reads an email", () => {
        expect(parseKeyQuery(" me@example.com ")).toEqual({ kind: "email", value: "me@example.com" });
    });
    it("reads a spaced, 0x-prefixed or short hex id", () => {
        expect(parseKeyQuery("f68a a906 b5be 601a c49e f83d c61f 975d ebde dc6b").value).toBe(FP);
        expect(parseKeyQuery(`0x${FP.toLowerCase()}`).value).toBe(FP);
        expect(parseKeyQuery("C61F975DEBDEDC6B").value).toBe("C61F975DEBDEDC6B");
    });
    it("refuses anything else", () => {
        expect(() => parseKeyQuery("hello")).toThrow();
        expect(() => parseKeyQuery("")).toThrow();
    });
});

describe("normalizeKeyServer", () => {
    it("keeps an https origin and drops a trailing path", () => {
        expect(normalizeKeyServer("https://keys.example.org/")).toBe("https://keys.example.org");
    });
    it("refuses http, credentials, queries and junk", () => {
        for (const bad of ["http://keys.example.org", "https://u:p@keys.example.org", "https://keys.example.org/?a=1", "keys.example.org", ""]) {
            expect(() => normalizeKeyServer(bad)).toThrow();
        }
    });
});

describe("findPgpKey", () => {
    it("asks the user's server first, then the defaults", async () => {
        const urls: string[] = [];
        const fetchImpl: KeyServerDeps["fetch"] = async url => {
            urls.push(url);
            return reply(404, "");
        };
        await expect(findPgpKey("me@example.com", "https://mine.example.org", deps(fetchImpl))).rejects.toThrow("No key found");
        expect(urls.map(u => new URL(u).origin)).toEqual(["https://mine.example.org", ...DEFAULT_KEY_SERVERS]);
        expect(urls[0]).toBe(lookupUrl("https://mine.example.org", { kind: "email", value: "me@example.com" }));
    });

    it("returns the first key it finds and says where from", async () => {
        const fetchImpl: KeyServerDeps["fetch"] = async url => (url.startsWith(DEFAULT_KEY_SERVERS[0]) ? reply(404, "") : reply(200, KEY, url));
        const found = await findPgpKey("me@example.com", null, deps(fetchImpl));
        expect(found).toEqual({ armored: KEY.trim(), fingerprint: FP, server: DEFAULT_KEY_SERVERS[1] });
    });

    it("skips a server that is down", async () => {
        const fetchImpl: KeyServerDeps["fetch"] = async url => {
            if (url.startsWith(DEFAULT_KEY_SERVERS[0])) throw new Error("offline");
            return reply(200, KEY, url);
        };
        expect((await findPgpKey("me@example.com", null, deps(fetchImpl))).server).toBe(DEFAULT_KEY_SERVERS[1]);
    });

    it("rejects a key whose fingerprint is not the one asked for", async () => {
        const fetchImpl: KeyServerDeps["fetch"] = async url => reply(200, KEY, url);
        const other = "A".repeat(40);
        await expect(findPgpKey(FP, null, deps(fetchImpl, other))).rejects.toThrow("No key found");
    });

    it("refuses a redirect off https and a body that is not a key", async () => {
        const insecure: KeyServerDeps["fetch"] = async () => reply(200, KEY, "http://evil.test/");
        await expect(findPgpKey("me@example.com", null, deps(insecure))).rejects.toThrow("No key found");
        const junk: KeyServerDeps["fetch"] = async url => reply(200, "<html>", url);
        await expect(findPgpKey("me@example.com", null, deps(junk))).rejects.toThrow("No key found");
    });

    it("asks for a fingerprint when an email matches several keys", async () => {
        const fetchImpl: KeyServerDeps["fetch"] = async url => reply(200, KEY, url);
        const several: KeyServerDeps = { fetch: fetchImpl, fingerprintOf: async () => { throw new Error("Paste exactly one PGP public key."); } };
        await expect(findPgpKey("me@example.com", null, several)).rejects.toThrow("more than one key");
    });
});
