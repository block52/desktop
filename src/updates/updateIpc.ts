import { app, BrowserWindow, dialog, ipcMain, net, shell } from "electron";
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

/** Help > Check for Updates: asks, then says what it found, so the answer is never silence. */
export async function checkForUpdatesFromMenu(): Promise<void> {
    const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const show = (options: Electron.MessageBoxOptions) => (parent !== undefined ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options));
    if (!app.isPackaged) {
        await show({ type: "info", message: "Updates are not checked in a development build.", buttons: ["OK"] });
        return;
    }
    const update = await checkForUpdate();
    if (update === null) {
        await show({ type: "info", message: "You are up to date.", detail: `Block52 ${app.getVersion()} is the latest version.`, buttons: ["OK"] });
        return;
    }
    const result = await show({ type: "info", message: `Block52 ${update.version} is available.`, detail: `You have ${app.getVersion()}.`, buttons: ["Not Now", "View Release"], defaultId: 1, cancelId: 0 });
    if (result.response === 1 && isValidVersion(update.version)) void shell.openExternal(releasePageUrl(update.version.replace(/^v/, "")));
}

export function registerUpdateIpc(): void {
    ipcMain.handle("update:check", () => checkForUpdate());

    // Only ever opens this project's own release page, for a version string that is plain x.y.z.
    ipcMain.on("update:open", (_event, version: unknown) => {
        if (!isValidVersion(version)) return;
        void shell.openExternal(releasePageUrl(version.replace(/^v/, "")));
    });
}
