import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, hostsFromUrls } from "./csp";

function directive(policy: string, name: string): string {
    const entry = policy.split("; ").find(part => part.startsWith(`${name} `));
    if (entry === undefined) throw new Error(`no ${name} directive`);
    return entry;
}

describe("buildContentSecurityPolicy", () => {
    const production = buildContentSecurityPolicy({ isDev: false, extraConnectHosts: [] });

    it("does not let a script connect to arbitrary hosts", () => {
        const connect = directive(production, "connect-src").split(" ");
        expect(connect).not.toContain("https:");
        expect(connect).not.toContain("wss:");
        expect(connect).not.toContain("*");
        expect(connect).toContain("https://rpc.walletconnect.org");
    });

    it("frames only the WalletConnect verify hosts", () => {
        expect(directive(production, "frame-src")).toBe("frame-src https://verify.walletconnect.org https://verify.walletconnect.com");
    });

    it("keeps analytics endpoints out of connect-src", () => {
        expect(production).not.toContain("pulse.walletconnect.org");
        expect(production).not.toContain("cca-lite.coinbase.com");
    });

    it("allows no inline or eval script in production, only WebAssembly", () => {
        const script = directive(production, "script-src");
        expect(script).not.toContain("'unsafe-inline'");
        expect(script).not.toContain("'unsafe-eval'");
        expect(script).toContain("'wasm-unsafe-eval'");
    });

    it("allows dev tooling only in development", () => {
        const development = buildContentSecurityPolicy({ isDev: true, extraConnectHosts: [] });
        expect(directive(development, "script-src")).toContain("'unsafe-eval'");
    });

    it("adds hosts from build-time settings", () => {
        const policy = buildContentSecurityPolicy({ isDev: false, extraConnectHosts: hostsFromUrls(["https://nft.example.com/{owner}?chain={chainId}"]) });
        expect(directive(policy, "connect-src")).toContain("https://nft.example.com");
    });

    it("blocks plugins, framing and form posts", () => {
        expect(production).toContain("object-src 'none'");
        expect(production).toContain("frame-ancestors 'none'");
        expect(production).toContain("form-action 'none'");
    });
});

describe("hostsFromUrls", () => {
    it("takes the origin of https urls, ignores blanks, http and junk", () => {
        expect(hostsFromUrls(["https://a.example.com/x/y", "", undefined, "http://insecure.example.com", "not a url"])).toEqual([
            "https://a.example.com",
            "wss://a.example.com"
        ]);
    });
});
