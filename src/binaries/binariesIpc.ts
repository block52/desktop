import { app, BrowserWindow, ipcMain, net } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, rm, chmod } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
    BINARY_NAMES,
    checksumMatches,
    latestReleaseApiUrl,
    parseLatestRelease,
    parseSha256File,
    parseVersionLong,
    platformAsset,
    sha256AssetName,
    updateAvailable,
    type BinaryName,
    type BinaryStatus,
    type InstalledVersion
} from "./binaryRelease";

const execFileAsync = promisify(execFile);
const REQUEST_TIMEOUT_MS = 10000;
const DOWNLOAD_TIMEOUT_MS = 120000;

function isBinaryName(value: unknown): value is BinaryName {
    return typeof value === "string" && (BINARY_NAMES as string[]).includes(value);
}

/** Where downloaded node binaries are installed, under the app's user-data folder. */
function binDir(): string {
    return path.join(app.getPath("userData"), "bin");
}

function binaryPath(binary: BinaryName): string {
    const asset = platformAsset(binary, process.platform, process.arch);
    const ext = asset?.endsWith(".exe") === true ? ".exe" : "";
    return path.join(binDir(), `${binary}${ext}`);
}

/** The installed binary's version info, or a null-filled record when it is not installed / unreadable. */
async function installedVersion(binary: BinaryName): Promise<InstalledVersion> {
    const empty: InstalledVersion = { version: null, commit: null, cosmosSdk: null, engine: null };
    const file = binaryPath(binary);
    if (!existsSync(file)) return empty;
    try {
        const { stdout } = await execFileAsync(file, ["version", "--long"], { timeout: REQUEST_TIMEOUT_MS });
        return parseVersionLong(stdout);
    } catch {
        // Some binaries (ws-server) may not take `version --long`; fall back to plain version.
        try {
            const { stdout } = await execFileAsync(file, ["version"], { timeout: REQUEST_TIMEOUT_MS });
            return { ...empty, version: stdout.trim().replace(/^v/, "") || null };
        } catch {
            return empty;
        }
    }
}

async function status(): Promise<BinaryStatus[]> {
    let latest: ReturnType<typeof parseLatestRelease> = null;
    try {
        const response = await net.fetch(latestReleaseApiUrl(), {
            headers: { Accept: "application/vnd.github+json" },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });
        if (response.ok) latest = parseLatestRelease(await response.json());
    } catch {
        latest = null;
    }

    return Promise.all(
        BINARY_NAMES.map(async (name): Promise<BinaryStatus> => {
            const installed = await installedVersion(name);
            const asset = latest?.assetFor(name, process.platform, process.arch) ?? null;
            return {
                name,
                installed,
                latest: latest?.version ?? null,
                publishedAt: latest?.publishedAt ?? null,
                assetName: asset?.name ?? null,
                updateAvailable: latest !== null && updateAvailable(installed.version, latest.version),
                notInstalled: installed.version === null
            };
        })
    );
}

/** Fetch an asset's body, streaming it to `dest`, hashing as it goes, reporting progress. Returns the sha256 hex. */
async function downloadTo(url: string, dest: string, totalBytes: number | null, onProgress: (received: number, total: number | null) => void): Promise<string> {
    const response = await net.fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!response.ok || response.body === null) throw new Error(`download failed (HTTP ${response.status})`);
    const hash = createHash("sha256");
    const out = createWriteStream(dest);
    let received = 0;
    const reader = response.body.getReader();
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            hash.update(value);
            received += value.byteLength;
            await new Promise<void>((resolve, reject) => out.write(value, err => (err ? reject(err) : resolve())));
            onProgress(received, totalBytes);
        }
    } finally {
        out.end();
    }
    return hash.digest("hex");
}

/**
 * Download the latest release's asset for a binary, verify its sha256, and
 * install it atomically into the app's bin dir (keeping the previous as
 * `<name>.prev`). Nothing is made executable or moved into place until the
 * checksum matches; a mismatch deletes the download and throws.
 */
async function download(binary: BinaryName, onProgress: (received: number, total: number | null) => void): Promise<{ version: string }> {
    const response = await net.fetch(latestReleaseApiUrl(), { headers: { Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`could not read the latest release (HTTP ${response.status})`);
    const release = parseLatestRelease(await response.json());
    if (release === null) throw new Error("no usable latest release");
    const asset = release.assetFor(binary, process.platform, process.arch);
    if (asset === null || asset.url === null) throw new Error("no download is published for your platform");

    // The matching .sha256 asset holds the expected digest.
    const shaUrl = asset.url.replace(/\/[^/]+$/, `/${sha256AssetName(asset.name)}`);
    const shaResponse = await net.fetch(shaUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!shaResponse.ok) throw new Error("could not read the checksum");
    const expected = parseSha256File(await shaResponse.text());
    if (expected === null) throw new Error("the checksum file is malformed");

    await mkdir(binDir(), { recursive: true });
    const finalPath = binaryPath(binary);
    const tmpPath = `${finalPath}.download`;
    try {
        const actual = await downloadTo(asset.url, tmpPath, asset.size, onProgress);
        if (!checksumMatches(expected, actual)) {
            await rm(tmpPath, { force: true });
            throw new Error("checksum mismatch — the download was discarded");
        }
        await chmod(tmpPath, 0o755);
        // Keep the previous version for rollback, then swap the verified file in.
        if (existsSync(finalPath)) await rename(finalPath, `${finalPath}.prev`).catch(() => undefined);
        await rename(tmpPath, finalPath);
    } catch (error) {
        await rm(tmpPath, { force: true });
        throw error;
    }
    return { version: release.version };
}

/**
 * Node binary versions + downloads over IPC (#75): what is installed, the latest
 * published release, whether an update is out, and downloading/verifying/
 * installing the latest. Calls only from the app's own window (same
 * trusted-sender check as the other IPC modules).
 */
export function registerBinariesIpc(): void {
    const trusted = (event: IpcMainInvokeEvent): boolean =>
        BrowserWindow.fromWebContents(event.sender) !== null && event.senderFrame === event.sender.mainFrame;

    ipcMain.handle("binaries:status", event => {
        if (!trusted(event)) throw new Error("Untrusted caller.");
        return status();
    });

    ipcMain.handle("binaries:download", async (event, name: unknown) => {
        if (!trusted(event)) throw new Error("Untrusted caller.");
        if (!isBinaryName(name)) throw new Error("Unknown binary.");
        const send = (received: number, total: number | null) =>
            event.sender.send("binaries:download-progress", { name, received, total });
        return download(name, send);
    });
}
