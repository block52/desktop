const FINGERPRINT_OR_KEY_ID = /^(?:0x)?([0-9A-Fa-f]{8}|[0-9A-Fa-f]{16}|[0-9A-Fa-f]{40}|[0-9A-Fa-f]{64})$/;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const MAX_KEY_CHARS = 200_000;
const REQUEST_TIMEOUT_MS = 10_000;

/** Searched in this order, after a server the user added. Both speak HKP (`/pks/lookup`). */
export const DEFAULT_KEY_SERVERS = ["https://keys.openpgp.org", "https://keyserver.ubuntu.com"];

export interface KeyQuery {
    kind: "email" | "hex";
    /** The email, or the fingerprint / key id as upper-case hex without a 0x. */
    value: string;
}

export interface FoundPgpKey {
    armored: string;
    fingerprint: string;
    server: string;
}

export interface KeyServerDeps {
    fetch: (url: string, init: { signal: AbortSignal; headers: Record<string, string> }) => Promise<{ ok: boolean; status: number; url: string; text: () => Promise<string> }>;
    /** The primary fingerprint of exactly one public key; throws for a private key, several keys or junk. */
    fingerprintOf: (armored: string) => Promise<string>;
}

/** An email address, or a fingerprint / key id with or without spaces and a 0x prefix. */
export function parseKeyQuery(raw: string): KeyQuery {
    const trimmed = raw.trim();
    if (EMAIL.test(trimmed)) return { kind: "email", value: trimmed };
    const hex = FINGERPRINT_OR_KEY_ID.exec(trimmed.replace(/\s+/g, ""));
    if (hex !== null) return { kind: "hex", value: hex[1].toUpperCase() };
    throw new Error("Enter an email address or a key fingerprint.");
}

/** Only https, with nothing after the host but an optional port: the lookup path is ours to add. */
export function normalizeKeyServer(raw: string): string {
    let url: URL;
    try {
        url = new URL(raw.trim());
    } catch {
        throw new Error("The key server must be an https:// address.");
    }
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
        throw new Error("The key server must be an https:// address.");
    }
    return url.origin;
}

export function lookupUrl(server: string, query: KeyQuery): string {
    const search = query.kind === "email" ? query.value : `0x${query.value}`;
    return `${server}/pks/lookup?op=get&options=mr&search=${encodeURIComponent(search)}`;
}

/** A fingerprint search must return that very key; a short key id (which can be forged) must at least end the same way. */
function matchesQuery(fingerprint: string, query: KeyQuery): boolean {
    return query.kind === "email" || fingerprint.toUpperCase().endsWith(query.value);
}

/**
 * Looks a public key up on the user's key server first, then the popular ones. A key server is only a directory:
 * anyone can upload a key for any email, so the caller must show the fingerprint for the user to confirm.
 */
export async function findPgpKey(rawQuery: string, customServer: string | null, deps: KeyServerDeps): Promise<FoundPgpKey> {
    const query = parseKeyQuery(rawQuery);
    const servers = [...(customServer !== null && customServer.trim() !== "" ? [normalizeKeyServer(customServer)] : []), ...DEFAULT_KEY_SERVERS];
    const unique = [...new Set(servers)];
    let ambiguous = false;

    for (const server of unique) {
        const url = lookupUrl(server, query);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await deps.fetch(url, { signal: controller.signal, headers: { accept: "application/pgp-keys" } });
            if (!response.ok || !response.url.startsWith("https://")) continue;
            const body = await response.text();
            if (body.length === 0 || body.length > MAX_KEY_CHARS || !body.includes("BEGIN PGP PUBLIC KEY BLOCK")) continue;
            const armored = body.trim();
            let fingerprint: string;
            try {
                fingerprint = await deps.fingerprintOf(armored);
            } catch (error) {
                if (error instanceof Error && error.message.includes("exactly one")) ambiguous = true;
                continue;
            }
            if (!matchesQuery(fingerprint, query)) continue;
            return { armored, fingerprint, server };
        } catch {
            // Unreachable, slow or refusing: try the next server.
        } finally {
            clearTimeout(timer);
        }
    }

    if (ambiguous) throw new Error("That search matched more than one key. Search by fingerprint instead.");
    throw new Error("No key found on the key servers. Add your own key server, or paste the key.");
}
