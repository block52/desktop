import { COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../context/NetworkContext";

// Automatic discovery of pokerchain nodes (#73). From a node that answers, read
// the validators' descriptions; each one that advertises a website is a
// candidate host. Build the standard endpoint pattern for it, verify the host
// actually serves the pokerchain (node_info), and return the ones that do.
//
// Peer IPs from /net_info are deliberately NOT probed: they are raw addresses on
// the p2p port (:26656) with no public HTTPS endpoint, so they can't be reached
// the way the app talks to a node. A validator's website is the reliable signal.

interface Candidate {
    name: string;
    host: string; // bare host, e.g. "node.example.com"
}

/** The standard public endpoint pattern Block52 nodes use (see NETWORK_PRESETS). */
export function endpointsForHost(name: string, host: string): NetworkEndpoints {
    return {
        name,
        rest: `https://${host}`,
        rpc: `https://${host}/rpc/`,
        grpc: `grpcs://${host}:9443`,
        ws: `wss://${host}/ws`
    };
}

/** The bare host from a validator website URL, or null if it isn't a usable https host. */
export function hostFromWebsite(website: unknown): string | null {
    if (typeof website !== "string" || website.trim() === "") return null;
    try {
        const url = new URL(website.trim());
        if (url.protocol !== "https:" && url.protocol !== "http:") return null;
        return url.hostname === "" ? null : url.hostname;
    } catch {
        return null;
    }
}

interface ValidatorDescription {
    description?: { moniker?: unknown; website?: unknown };
}

/** Candidates (name + host) from a validators response, de-duplicated by host. */
export function candidatesFromValidators(response: unknown): Candidate[] {
    const validators = (response as { validators?: ValidatorDescription[] } | null)?.validators;
    if (!Array.isArray(validators)) return [];
    const byHost = new Map<string, Candidate>();
    for (const v of validators) {
        const host = hostFromWebsite(v.description?.website);
        if (host === null || byHost.has(host)) continue;
        const moniker = typeof v.description?.moniker === "string" && v.description.moniker !== "" ? v.description.moniker : host;
        byHost.set(host, { name: moniker, host });
    }
    return [...byHost.values()];
}

/** Does this host serve the pokerchain? Reads node_info and checks the network id. */
export async function verifyPokerchain(host: string, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<boolean> {
    try {
        const res = await fetchImpl(`https://${host}/cosmos/base/tendermint/v1beta1/node_info`, { signal });
        if (!res.ok) return false;
        const info = (await res.json()) as { default_node_info?: { network?: unknown } };
        return info.default_node_info?.network === COSMOS_CONSTANTS.CHAIN_ID;
    } catch {
        return false;
    }
}

/**
 * Discover pokerchain nodes from a reachable node's validator set. Returns only
 * verified endpoints, excluding hosts already in `known` (presets + current
 * discovered list). Read-only: it never writes anything to any node.
 */
export async function discoverNetworks(
    fromRest: string,
    known: NetworkEndpoints[],
    fetchImpl: typeof fetch = fetch,
    signal?: AbortSignal
): Promise<NetworkEndpoints[]> {
    const base = fromRest.replace(/\/+$/, "");
    let candidates: Candidate[] = [];
    try {
        const res = await fetchImpl(`${base}/cosmos/staking/v1beta1/validators?pagination.limit=100`, { signal });
        if (res.ok) candidates = candidatesFromValidators(await res.json());
    } catch {
        return [];
    }

    const knownHosts = new Set(known.map(n => hostFromWebsite(n.rest) ?? n.rest));
    const fresh = candidates.filter(c => !knownHosts.has(c.host) && !known.some(n => n.name === c.name));

    const verified = await Promise.all(
        fresh.map(async c => ((await verifyPokerchain(c.host, fetchImpl, signal)) ? endpointsForHost(c.name, c.host) : null))
    );
    return verified.filter((n): n is NetworkEndpoints => n !== null);
}
