/** The URL scheme the OS hands to this app: block52://table/<id> and block52://tournament/<id>. */
export const DEEP_LINK_SCHEME = "block52";

const HASH = "0x[0-9a-fA-F]{64}";
const TABLE = new RegExp(`^(${HASH}(?:-t\\d+)?)$`);
const TOURNAMENT = new RegExp(`^(${HASH})$`);
const TABLE_ROUTE = new RegExp(`^/table/${HASH}(?:-t\\d+)?$`);
const TOURNAMENT_ROUTE = new RegExp(`^/tournament/${HASH}$`);

/**
 * The in-app route a link points at, or null for anything else. A link can only ever open a table or a tournament
 * page: no other host, no extra path, and the id must be the exact shape. Query strings and fragments are ignored.
 */
export function parseDeepLink(raw: string): string | null {
    let url: URL;
    try {
        url = new URL(raw.trim());
    } catch {
        return null;
    }
    if (url.protocol !== `${DEEP_LINK_SCHEME}:` || url.username !== "" || url.password !== "") return null;
    const kind = url.hostname.toLowerCase();
    let id: string;
    try {
        id = decodeURIComponent(url.pathname.replace(/^\/+/, "").replace(/\/+$/, ""));
    } catch {
        return null;
    }
    if (kind === "table" && TABLE.test(id)) return `/table/${id.toLowerCase()}`;
    if (kind === "tournament" && TOURNAMENT.test(id)) return `/tournament/${id.toLowerCase()}`;
    return null;
}

/** The first link in a command line (Windows and Linux pass it as an argument), as a route. */
export function findDeepLink(argv: readonly string[]): string | null {
    for (const arg of argv) {
        if (arg.toLowerCase().startsWith(`${DEEP_LINK_SCHEME}://`)) {
            const route = parseDeepLink(arg);
            if (route !== null) return route;
        }
    }
    return null;
}

/** Whether a route is one a link may open. The page checks this again, since a message from the main process is still input. */
export function isDeepLinkRoute(value: unknown): value is string {
    return typeof value === "string" && (TABLE_ROUTE.test(value) || TOURNAMENT_ROUTE.test(value));
}

/** The link to share for a table or a tournament. */
export function deepLinkFor(kind: "table" | "tournament", id: string): string {
    return `${DEEP_LINK_SCHEME}://${kind}/${id}`;
}
