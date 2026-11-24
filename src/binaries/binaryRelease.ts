import { isNewer, isValidVersion } from "../updates/updateCheck";

// Version reporting + update detection for the Block52 node binaries
// (pokerchaind, ws-server). This slice (#75) finds the latest published
// release and the installed version and decides whether an update exists; the
// download + checksum verify + install is a follow-up.

export const BINARY_RELEASE_REPO = "block52/pokerchain-releases";

export type BinaryName = "pokerchaind" | "ws-server";
export const BINARY_NAMES: BinaryName[] = ["pokerchaind", "ws-server"];

export function latestReleaseApiUrl(): string {
    return `https://api.github.com/repos/${BINARY_RELEASE_REPO}/releases/latest`;
}

/** This platform's os/arch as the release assets name them (`darwin`/`linux`/`windows`, `amd64`/`arm64`). */
export function platformAsset(binary: BinaryName, platform: NodeJS.Platform, arch: string): string | null {
    const os = platform === "darwin" ? "darwin" : platform === "win32" ? "windows" : platform === "linux" ? "linux" : null;
    const goArch = arch === "arm64" ? "arm64" : arch === "x64" ? "amd64" : null;
    if (os === null || goArch === null) return null;
    const ext = os === "windows" ? ".exe" : "";
    return `${binary}-${os}-${goArch}${ext}`;
}

interface ReleaseAsset {
    name: string;
    browser_download_url?: string;
    size?: number;
}

export interface BinaryRelease {
    /** Tag without the leading "v", e.g. "0.1.210". */
    version: string;
    tag: string;
    publishedAt: string | null;
    /** The asset for a binary on this platform, or null when none is published. */
    assetFor: (binary: BinaryName, platform: NodeJS.Platform, arch: string) => { name: string; url: string | null; size: number | null } | null;
}

/** Parse the GitHub "latest release" reply into a BinaryRelease, or null if it has no usable version. */
export function parseLatestRelease(release: unknown): BinaryRelease | null {
    if (typeof release !== "object" || release === null) return null;
    const r = release as Record<string, unknown>;
    if (r.draft === true || r.prerelease === true) return null;
    if (typeof r.tag_name !== "string" || !isValidVersion(r.tag_name)) return null;
    const assets = Array.isArray(r.assets) ? (r.assets as ReleaseAsset[]) : [];
    const byName = new Map(assets.map(a => [a.name, a]));
    return {
        tag: r.tag_name,
        version: r.tag_name.replace(/^v/, ""),
        publishedAt: typeof r.published_at === "string" ? r.published_at : null,
        assetFor: (binary, platform, arch) => {
            const name = platformAsset(binary, platform, arch);
            if (name === null) return null;
            const asset = byName.get(name);
            if (asset === undefined) return null;
            return { name, url: asset.browser_download_url ?? null, size: typeof asset.size === "number" ? asset.size : null };
        }
    };
}

export interface InstalledVersion {
    /** The binary's own version, e.g. "0.1.66", or null when not installed / unreadable. */
    version: string | null;
    commit: string | null;
    cosmosSdk: string | null;
    engine: string | null;
}

/**
 * Parse `pokerchaind version --long` YAML-ish output. Only the top-level scalar
 * fields are read (version, commit, cosmos_sdk_version); the engine version is
 * taken from build_deps if the module is listed, else null.
 */
export function parseVersionLong(output: string): InstalledVersion {
    const scalar = (key: string): string | null => {
        const m = new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m").exec(output);
        return m === null ? null : m[1].replace(/^"|"$/g, "");
    };
    const rawVersion = scalar("version");
    const version = rawVersion === null ? null : rawVersion.replace(/^v/, "");

    // The poker engine is a build dep (github.com/block52/poker-vm/...@vX.Y.Z).
    const engineMatch = /github\.com\/block52\/poker-vm\/[^\s@]*@(v?\d+\.\d+\.\d+\S*)/.exec(output);

    return {
        version,
        commit: scalar("commit"),
        cosmosSdk: scalar("cosmos_sdk_version"),
        engine: engineMatch === null ? null : engineMatch[1]
    };
}

/** Whether the latest release is newer than what is installed (false if either is unknown). */
export function updateAvailable(installed: string | null, latest: string): boolean {
    if (installed === null) return false; // "not installed" is prompted separately, not an update
    return isNewer(latest, installed);
}

/** The hex digest from a `.sha256` asset, which is either "abc123" or "abc123  filename". Lowercased; null if unparseable. */
export function parseSha256File(content: string): string | null {
    const first = content.trim().split(/\s+/)[0] ?? "";
    return /^[0-9a-f]{64}$/i.test(first) ? first.toLowerCase() : null;
}

/** True when the downloaded file's digest matches the expected one (case-insensitive). */
export function checksumMatches(expected: string, actual: string): boolean {
    return expected.toLowerCase() === actual.toLowerCase();
}

/** The `.sha256` asset name for a binary asset. */
export function sha256AssetName(assetName: string): string {
    return `${assetName}.sha256`;
}

/** Per-binary status returned to the renderer (renderer-safe: no node imports here). */
export interface BinaryStatus {
    name: BinaryName;
    installed: InstalledVersion;
    latest: string | null;
    publishedAt: string | null;
    /** The asset published for this platform, or null when there is none. */
    assetName: string | null;
    updateAvailable: boolean;
    /** True when nothing is installed yet. */
    notInstalled: boolean;
}
