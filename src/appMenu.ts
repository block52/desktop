import type { MenuItemConstructorOptions } from "electron";
import type { MenuRoute } from "./menuRoutes";

export interface MenuActions {
    navigate: (route: MenuRoute) => void;
    lockWallet: () => void;
    checkForUpdates: () => void;
    about: () => void;
    openExternal: (url: string) => void;
}

interface MenuOptions {
    platform: NodeJS.Platform;
    appName: string;
    /** Running from source: the reload and developer-tools items are only there for development. */
    isDev: boolean;
    actions: MenuActions;
}

export const REPO_URL = "https://github.com/block52/desktop";
export const WEBSITE_URL = "https://block52.xyz";

/** The window menu. A pure description so it can be checked without Electron. */
export function buildMenuTemplate({ platform, appName, isDev, actions }: MenuOptions): MenuItemConstructorOptions[] {
    const isMac = platform === "darwin";
    const go = (label: string, route: MenuRoute, accelerator?: string): MenuItemConstructorOptions => ({
        label,
        ...(accelerator !== undefined ? { accelerator } : {}),
        click: () => actions.navigate(route),
    });

    const appMenu: MenuItemConstructorOptions[] = isMac
        ? [
              {
                  label: appName,
                  submenu: [
                      { label: `About ${appName}`, click: actions.about },
                      { label: "Check for Updates…", click: actions.checkForUpdates },
                      { type: "separator" },
                      { role: "services" },
                      { type: "separator" },
                      { role: "hide" },
                      { role: "hideOthers" },
                      { role: "unhide" },
                      { type: "separator" },
                      { role: "quit" },
                  ],
              },
          ]
        : [];

    const fileMenu: MenuItemConstructorOptions = {
        label: "File",
        submenu: [
            { label: "Lock Wallet", accelerator: "CmdOrCtrl+L", click: actions.lockWallet },
            { type: "separator" },
            isMac ? { role: "close" } : { role: "quit" },
        ],
    };

    const editMenu: MenuItemConstructorOptions = {
        label: "Edit",
        submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "selectAll" },
        ],
    };

    const viewMenu: MenuItemConstructorOptions = {
        label: "View",
        submenu: [
            ...(isDev ? ([{ role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" }, { type: "separator" }] as MenuItemConstructorOptions[]) : []),
            { role: "resetZoom" },
            { role: "zoomIn" },
            { role: "zoomOut" },
            { type: "separator" },
            { role: "togglefullscreen" },
        ],
    };

    const goMenu: MenuItemConstructorOptions = {
        label: "Go",
        submenu: [
            go("Lobby", "/", "CmdOrCtrl+1"),
            go("Wallet", "/wallet", "CmdOrCtrl+2"),
            go("Hand History", "/hand-history", "CmdOrCtrl+3"),
            go("Players", "/players", "CmdOrCtrl+4"),
            { type: "separator" },
            go("Block Explorer", "/explorer", "CmdOrCtrl+5"),
            go("Hand Distribution", "/hand-distribution", "CmdOrCtrl+6"),
            go("Nodes", "/nodes", "CmdOrCtrl+7"),
            go("Tech Notes", "/tech-notes"),
        ],
    };

    const windowMenu: MenuItemConstructorOptions = {
        label: "Window",
        submenu: isMac ? [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }] : [{ role: "minimize" }, { role: "close" }],
    };

    const helpMenu: MenuItemConstructorOptions = {
        label: "Help",
        role: "help",
        submenu: [
            ...(isMac ? [] : ([{ label: "Check for Updates…", click: actions.checkForUpdates }, { type: "separator" }] as MenuItemConstructorOptions[])),
            { label: "Block52 Website", click: () => actions.openExternal(WEBSITE_URL) },
            { label: "Release Notes", click: () => actions.openExternal(`${REPO_URL}/releases`) },
            { label: "Report an Issue", click: () => actions.openExternal(`${REPO_URL}/issues/new`) },
            ...(isMac ? [] : ([{ type: "separator" }, { label: `About ${appName}`, click: actions.about }] as MenuItemConstructorOptions[])),
        ],
    };

    return [...appMenu, fileMenu, editMenu, viewMenu, goMenu, windowMenu, helpMenu];
}
