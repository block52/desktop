/**
 * Bridge history. Two sources are combined:
 *  - what this app sent (a record kept when a deposit is made, which has the Ethereum tx hash), and
 *  - what the chain minted for the address (deposit_synced / deposit_skipped block events, which cover deposits made
 *    from any app but carry no Ethereum tx hash).
 * The chain's `is_tx_processed` tells whether a recorded deposit has minted yet.
 */

export interface LocalDeposit {
    hash: string;
    /** Micro-USDC, as a decimal string. */
    amount: string;
    token: string;
    /** When it was sent, in milliseconds. */
    time: number;
}

export interface ChainMint {
    kind: "minted" | "skipped";
    /** Micro-USDC, as a decimal string. */
    amount: string;
    height: number;
    /** Block time in milliseconds. */
    time: number;
    reason?: string;
}

export type BridgeStatus = "sent" | "minted" | "skipped";

export interface BridgeRow {
    key: string;
    status: BridgeStatus;
    amount: string;
    token: string | null;
    time: number;
    txHash: string | null;
    mintHeight: number | null;
    reason: string | null;
}

const STORAGE_PREFIX = "b52.bridgeDeposits.";
const KEEP = 50;
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

function isLocalDeposit(value: unknown): value is LocalDeposit {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    return typeof v.hash === "string" && TX_HASH.test(v.hash) && typeof v.amount === "string" && /^\d+$/.test(v.amount) && typeof v.token === "string" && typeof v.time === "number";
}

/** The deposits this app sent for an address. Storage can be empty, cleared or blocked; that reads as no history. */
export function loadLocalDeposits(address: string): LocalDeposit[] {
    try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(`${STORAGE_PREFIX}${address}`) ?? "[]");
        return Array.isArray(parsed) ? parsed.filter(isLocalDeposit) : [];
    } catch {
        return [];
    }
}

/** Remembers a deposit (newest first, once per Ethereum tx hash). Returns false if storage refused it. */
export function saveLocalDeposit(address: string, deposit: LocalDeposit): boolean {
    try {
        const others = loadLocalDeposits(address).filter(existing => existing.hash.toLowerCase() !== deposit.hash.toLowerCase());
        window.localStorage.setItem(`${STORAGE_PREFIX}${address}`, JSON.stringify([deposit, ...others].slice(0, KEEP)));
        return true;
    } catch {
        return false;
    }
}

interface RawEvent {
    type?: string;
    attributes?: { key?: string; value?: string }[];
}

/** The mint and skip events for one address in a block's results (CometBFT puts block events under finalize_block_events or end_block_events). */
export function parseMintEvents(events: RawEvent[], address: string, height: number, time: number): ChainMint[] {
    const mine = address.toLowerCase();
    const out: ChainMint[] = [];
    for (const event of events) {
        if (event.type !== "deposit_synced" && event.type !== "deposit_skipped") continue;
        const attribute = (key: string) => event.attributes?.find(candidate => candidate.key === key)?.value;
        const recipient = attribute("recipient");
        const amount = attribute("amount");
        if (recipient === undefined || recipient.toLowerCase() !== mine || amount === undefined || !/^\d+$/.test(amount)) continue;
        out.push({ kind: event.type === "deposit_synced" ? "minted" : "skipped", amount, height, time, ...(event.type === "deposit_skipped" ? { reason: attribute("reason") ?? "" } : {}) });
    }
    return out;
}

/**
 * One list, newest first. A recorded deposit the chain has processed is paired with the earliest unused mint of the same
 * amount that came after it, so it shows once, as minted, with its Ethereum tx hash. A recorded deposit not yet processed
 * is "sent". Mints with no recorded deposit (another app, another machine) are listed without a hash.
 */
export function mergeBridgeHistory(local: (LocalDeposit & { processed: boolean })[], mints: ChainMint[]): BridgeRow[] {
    const rows: BridgeRow[] = [];
    const unused = [...mints].sort((a, b) => a.height - b.height);
    for (const deposit of [...local].sort((a, b) => a.time - b.time)) {
        if (!deposit.processed) {
            rows.push({ key: deposit.hash, status: "sent", amount: deposit.amount, token: deposit.token, time: deposit.time, txHash: deposit.hash, mintHeight: null, reason: null });
            continue;
        }
        const index = unused.findIndex(mint => mint.kind === "minted" && mint.amount === deposit.amount && mint.time >= deposit.time);
        const mint = index >= 0 ? unused.splice(index, 1)[0] : undefined;
        rows.push({ key: deposit.hash, status: "minted", amount: deposit.amount, token: deposit.token, time: mint?.time ?? deposit.time, txHash: deposit.hash, mintHeight: mint?.height ?? null, reason: null });
    }
    for (const mint of unused) {
        rows.push({
            key: `${mint.height}:${mint.kind}:${mint.amount}`,
            status: mint.kind === "minted" ? "minted" : "skipped",
            amount: mint.amount,
            token: null,
            time: mint.time,
            txHash: null,
            mintHeight: mint.height,
            reason: mint.reason ?? null
        });
    }
    return rows.sort((a, b) => b.time - a.time);
}
