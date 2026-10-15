export const RELEASE_REPO = "xiangzhe0812/poker-desktop";

export interface UpdateInfo {
    /** The newer version, without the leading "v". */
    version: string;
}

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;

function parts(version: string): [number, number, number] | null {
    const match = SEMVER.exec(version);
    if (match === null) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isValidVersion(version: unknown): version is string {
    return typeof version === "string" && parts(version) !== null;
}

/** True when `candidate` is a higher x.y.z than `current`. Anything that is not plain x.y.z (pre-releases) never counts. */
export function isNewer(candidate: string, current: string): boolean {
    const next = parts(candidate);
    const now = parts(current);
    if (next === null || now === null) return false;
    for (let i = 0; i < 3; i += 1) {
        if (next[i] !== now[i]) return next[i] > now[i];
    }
    return false;
}

/** The newer version named by a GitHub "latest release" reply, or null when there is none worth showing. */
export function newerVersionFrom(release: unknown, current: string): UpdateInfo | null {
    if (typeof release !== "object" || release === null) return null;
    const r = release as Record<string, unknown>;
    if (r.draft === true || r.prerelease === true) return null;
    if (typeof r.tag_name !== "string" || !isValidVersion(r.tag_name)) return null;
    const version = r.tag_name.replace(/^v/, "");
    return isNewer(version, current) ? { version } : null;
}

export function releasePageUrl(version: string): string {
    return `https://github.com/${RELEASE_REPO}/releases/tag/v${version}`;
}

export function latestReleaseApiUrl(): string {
    return `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;
}
