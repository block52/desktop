import { app, ipcMain, net, shell } from "electron";
import { isValidVersion, latestReleaseApiUrl, newerVersionFrom, releasePageUrl, type UpdateInfo } from "./updateCheck";

const REQUEST_TIMEOUT_MS = 10000;

/** Asks GitHub for the latest published release. Any failure (offline, private repo, rate limit) simply means no notice. */
async function checkForUpdate(): Promise<UpdateInfo | null> {
    if (!app.isPackaged) return null;
    try {
        const response = await net.fetch(latestReleaseApiUrl(), {
            headers: { Accept: "application/vnd.github+json" },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) return null;
        return newerVersionFrom(await response.json(), app.getVersion());
    } catch {
        return null;
    }
}

export function registerUpdateIpc(): void {
    ipcMain.handle("update:check", () => checkForUpdate());

    // Only ever opens this project's own release page, for a version string that is plain x.y.z.
    ipcMain.on("update:open", (_event, version: unknown) => {
        if (!isValidVersion(version)) return;
        void shell.openExternal(releasePageUrl(version.replace(/^v/, "")));
    });
}
