import { describe, expect, it, vi } from "vitest";
import type { MenuItemConstructorOptions } from "electron";
import { buildMenuTemplate, REPO_URL } from "./appMenu";
import { isMenuRoute } from "./menuRoutes";

function actions() {
    return { navigate: vi.fn(), lockWallet: vi.fn(), checkForUpdates: vi.fn(), about: vi.fn(), openExternal: vi.fn() };
}

function items(menu: MenuItemConstructorOptions[], label: string): MenuItemConstructorOptions[] {
    const found = menu.find(entry => entry.label === label);
    return (found?.submenu ?? []) as MenuItemConstructorOptions[];
}

const roles = (list: MenuItemConstructorOptions[]) => list.map(item => item.role);

describe("buildMenuTemplate", () => {
    it("opens each screen from the Go menu", () => {
        const a = actions();
        const menu = buildMenuTemplate({ platform: "linux", appName: "Block52", isDev: false, actions: a });
        const go = items(menu, "Go");
        go.find(item => item.label === "Wallet")?.click?.({} as never, undefined, {} as never);
        expect(a.navigate).toHaveBeenCalledWith("/wallet");
        expect(go.filter(item => item.click !== undefined).length).toBe(8);
    });

    it("only offers routes the page accepts", () => {
        const a = actions();
        const menu = buildMenuTemplate({ platform: "linux", appName: "Block52", isDev: false, actions: a });
        for (const item of items(menu, "Go")) item.click?.({} as never, undefined, {} as never);
        for (const [route] of a.navigate.mock.calls) expect(isMenuRoute(route)).toBe(true);
    });

    it("gives every shortcut once", () => {
        const menu = buildMenuTemplate({ platform: "linux", appName: "Block52", isDev: false, actions: actions() });
        const shortcuts = menu.flatMap(entry => (entry.submenu as MenuItemConstructorOptions[]).map(item => item.accelerator)).filter(Boolean);
        expect(new Set(shortcuts).size).toBe(shortcuts.length);
    });

    it("hides reload and developer tools outside development", () => {
        const packaged = roles(items(buildMenuTemplate({ platform: "linux", appName: "Block52", isDev: false, actions: actions() }), "View"));
        const dev = roles(items(buildMenuTemplate({ platform: "linux", appName: "Block52", isDev: true, actions: actions() }), "View"));
        expect(packaged).not.toContain("toggleDevTools");
        expect(packaged).not.toContain("reload");
        expect(dev).toContain("toggleDevTools");
    });

    it("puts the app menu first on macOS and the quit item under File elsewhere", () => {
        const mac = buildMenuTemplate({ platform: "darwin", appName: "Block52", isDev: false, actions: actions() });
        const other = buildMenuTemplate({ platform: "win32", appName: "Block52", isDev: false, actions: actions() });
        expect(mac[0].label).toBe("Block52");
        expect(roles(items(other, "File"))).toContain("quit");
        expect(roles(items(mac, "File"))).not.toContain("quit");
    });

    it("opens help links on this project's pages over https", () => {
        const a = actions();
        const menu = buildMenuTemplate({ platform: "linux", appName: "Block52", isDev: false, actions: a });
        for (const item of items(menu, "Help")) item.click?.({} as never, undefined, {} as never);
        const urls = a.openExternal.mock.calls.map(([url]) => String(url));
        expect(urls.length).toBe(3);
        expect(urls.every(url => url.startsWith("https://"))).toBe(true);
        expect(urls).toContain(`${REPO_URL}/issues/new`);
    });

    it("locks the wallet from the File menu", () => {
        const a = actions();
        const menu = buildMenuTemplate({ platform: "linux", appName: "Block52", isDev: false, actions: a });
        items(menu, "File").find(item => item.label === "Lock Wallet")?.click?.({} as never, undefined, {} as never);
        expect(a.lockWallet).toHaveBeenCalledOnce();
    });
});
