import { describe, expect, it } from "vitest";
import {
    parseLatestRelease,
    parseVersionLong,
    platformAsset,
    updateAvailable
} from "./binaryRelease";

describe("platformAsset", () => {
    it("names the asset for each supported platform/arch", () => {
        expect(platformAsset("pokerchaind", "darwin", "arm64")).toBe("pokerchaind-darwin-arm64");
        expect(platformAsset("pokerchaind", "darwin", "x64")).toBe("pokerchaind-darwin-amd64");
        expect(platformAsset("pokerchaind", "linux", "arm64")).toBe("pokerchaind-linux-arm64");
        expect(platformAsset("ws-server", "linux", "x64")).toBe("ws-server-linux-amd64");
        expect(platformAsset("pokerchaind", "win32", "x64")).toBe("pokerchaind-windows-amd64.exe");
    });
    it("returns null for an unsupported platform/arch", () => {
        expect(platformAsset("pokerchaind", "freebsd" as NodeJS.Platform, "x64")).toBeNull();
        expect(platformAsset("pokerchaind", "darwin", "ia32")).toBeNull();
    });
});

describe("parseLatestRelease", () => {
    const release = {
        tag_name: "v0.1.210",
        published_at: "2026-11-20T00:00:00Z",
        draft: false,
        prerelease: false,
        assets: [
            { name: "pokerchaind-darwin-arm64", browser_download_url: "https://x/d-arm64", size: 123 },
            { name: "pokerchaind-linux-amd64", browser_download_url: "https://x/d-linux", size: 456 }
        ]
    };

    it("parses the version and finds this platform's asset", () => {
        const parsed = parseLatestRelease(release);
        expect(parsed?.version).toBe("0.1.210");
        expect(parsed?.tag).toBe("v0.1.210");
        const asset = parsed?.assetFor("pokerchaind", "darwin", "arm64");
        expect(asset).toEqual({ name: "pokerchaind-darwin-arm64", url: "https://x/d-arm64", size: 123 });
    });

    it("returns null asset when none is published for the platform", () => {
        const parsed = parseLatestRelease(release);
        expect(parsed?.assetFor("pokerchaind", "win32", "x64")).toBeNull();
    });

    it("rejects drafts, prereleases and bad tags", () => {
        expect(parseLatestRelease({ ...release, draft: true })).toBeNull();
        expect(parseLatestRelease({ ...release, prerelease: true })).toBeNull();
        expect(parseLatestRelease({ ...release, tag_name: "nightly" })).toBeNull();
        expect(parseLatestRelease(null)).toBeNull();
    });
});

describe("parseVersionLong", () => {
    // The real `pokerchaind version --long` output shape.
    const output = [
        "build_deps:",
        "- cosmossdk.io/api@v0.9.2",
        "- github.com/block52/poker-vm/pvm/go/engine@v1.0.38",
        "build_tags: \"\"",
        "commit: 5c88eff51e41e5cd607199a55570de58bed5621b",
        "cosmos_sdk_version: v0.53.6",
        "name: pokerchain",
        "server_name: pokerchaind",
        "version: v0.1.66"
    ].join("\n");

    it("reads version, commit, cosmos sdk and the engine dep", () => {
        const v = parseVersionLong(output);
        expect(v.version).toBe("0.1.66");
        expect(v.commit).toBe("5c88eff51e41e5cd607199a55570de58bed5621b");
        expect(v.cosmosSdk).toBe("v0.53.6");
        expect(v.engine).toBe("v1.0.38");
    });

    it("leaves the engine null when the module is not a build dep", () => {
        const v = parseVersionLong("version: v0.1.66\ncommit: abc\n");
        expect(v.version).toBe("0.1.66");
        expect(v.engine).toBeNull();
    });
});

describe("updateAvailable", () => {
    it("is true only when the latest is a higher version than the installed", () => {
        expect(updateAvailable("0.1.66", "0.1.210")).toBe(true);
        expect(updateAvailable("0.1.210", "0.1.210")).toBe(false);
        expect(updateAvailable("0.2.0", "0.1.210")).toBe(false);
        expect(updateAvailable(null, "0.1.210")).toBe(false); // not installed is handled separately
    });
});

import { checksumMatches, parseSha256File, sha256AssetName } from "./binaryRelease";

describe("checksum helpers", () => {
    const hash = "a".repeat(64);
    it("parses a bare digest and a 'digest  filename' line", () => {
        expect(parseSha256File(hash)).toBe(hash);
        expect(parseSha256File(`${hash}  pokerchaind-darwin-arm64\n`)).toBe(hash);
        expect(parseSha256File(hash.toUpperCase())).toBe(hash); // lowercased
    });
    it("rejects garbage", () => {
        expect(parseSha256File("")).toBeNull();
        expect(parseSha256File("not a hash")).toBeNull();
        expect(parseSha256File("abc123")).toBeNull(); // too short
    });
    it("compares case-insensitively", () => {
        expect(checksumMatches(hash, hash.toUpperCase())).toBe(true);
        expect(checksumMatches(hash, "b".repeat(64))).toBe(false);
    });
    it("names the sha256 asset", () => {
        expect(sha256AssetName("pokerchaind-darwin-arm64")).toBe("pokerchaind-darwin-arm64.sha256");
    });
});
