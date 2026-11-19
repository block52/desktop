/** The screens the window menu can open. Shared by the main process (which sends one) and the page (which checks it). */
export const MENU_ROUTES = ["/", "/wallet", "/hand-history", "/players", "/explorer", "/hand-distribution", "/nodes", "/tech-notes"] as const;

export type MenuRoute = (typeof MENU_ROUTES)[number];

export function isMenuRoute(value: unknown): value is MenuRoute {
    return typeof value === "string" && (MENU_ROUTES as readonly string[]).includes(value);
}
