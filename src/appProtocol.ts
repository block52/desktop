import path from "node:path";

export const APP_SCHEME = "app";
export const APP_HOST = "block52";
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/**
 * Maps an `app://block52/...` request to a file inside the renderer build folder.
 * Returns null for another host or any path that would leave the folder.
 */
export function resolveAppFile(rootDir: string, requestUrl: string): string | null {
    let url: URL;
    try {
        url = new URL(requestUrl);
    } catch {
        return null;
    }
    if (url.protocol !== `${APP_SCHEME}:` || url.host !== APP_HOST) return null;

    let pathname: string;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        return null;
    }
    const relative = pathname === "" || pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const root = path.resolve(rootDir);
    const file = path.resolve(root, relative);
    if (file !== root && !file.startsWith(root + path.sep)) return null;
    return file;
}

/** True for pages and files of the app itself (packaged scheme or the dev server), never for remote responses. */
export function isOwnResource(requestUrl: string, devServerUrl: string | undefined): boolean {
    try {
        const url = new URL(requestUrl);
        if (url.protocol === `${APP_SCHEME}:` && url.host === APP_HOST) return true;
        return devServerUrl !== undefined && devServerUrl !== "" && url.origin === new URL(devServerUrl).origin;
    } catch {
        return false;
    }
}
