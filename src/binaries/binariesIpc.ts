import { app, BrowserWindow, ipcMain, net } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import {
    BINARY_NAMES,
    latestReleaseApiUrl,
    parseLatestRelease,
    parseVersionLong,
    platformAsset,
    updateAvailable,
    type BinaryName,
    type BinaryStatus,
    type InstalledVersion
} from "./binaryRelease";

const execFileAsync = promisify(execFile);
const REQUEST_TIMEOUT_MS = 10000;

/** Where downloaded node binaries live (a later PR installs here; for now we just read what's present). */
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

/**
 * Node binary versions over IPC (#75): what is installed, the latest published
 * release, and whether an update is out. Read-only — this slice reports
 * versions; downloading/installing is a follow-up. Calls only from the app's
 * own window (same trusted-sender check as the other IPC modules).
 */
export function registerBinariesIpc(): void {
    const trusted = (event: IpcMainInvokeEvent): boolean =>
        BrowserWindow.fromWebContents(event.sender) !== null && event.senderFrame === event.sender.mainFrame;

    ipcMain.handle("binaries:status", event => {
        if (!trusted(event)) throw new Error("Untrusted caller.");
        return status();
    });
}
