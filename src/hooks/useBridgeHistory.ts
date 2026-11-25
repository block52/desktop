import { useCallback, useEffect, useState } from "react";
import { useNetwork } from "../context/NetworkContext";
import { loadLocalDeposits, mergeBridgeHistory, parseMintEvents } from "../utils/bridgeHistory";
import type { BridgeRow, ChainMint } from "../utils/bridgeHistory";

const MAX_BLOCKS = 20;
const POLL_MS = 15_000;
const CONCURRENCY = 4;

interface RpcBlockSearch {
    result?: { blocks?: { block?: { header?: { height?: string; time?: string } } }[] };
}

interface RpcBlockResults {
    result?: { finalize_block_events?: unknown[]; end_block_events?: unknown[] };
}

async function getJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
}

/** The newest blocks that minted (or skipped) a deposit for this address, found with CometBFT block_search. */
async function loadMints(rpc: string, address: string): Promise<ChainMint[]> {
    const order = encodeURIComponent("\"desc\"");
    const blocks = new Map<number, number>();
    for (const type of ["deposit_synced", "deposit_skipped"]) {
        const query = encodeURIComponent(`"${type}.recipient='${address}'"`);
        const found = await getJson<RpcBlockSearch>(`${rpc}/block_search?query=${query}&per_page=${MAX_BLOCKS}&order_by=${order}`);
        for (const entry of found.result?.blocks ?? []) {
            const height = Number(entry.block?.header?.height);
            const time = Date.parse(entry.block?.header?.time ?? "");
            if (Number.isInteger(height) && !Number.isNaN(time)) blocks.set(height, time);
        }
    }
    const heights = [...blocks.keys()].sort((a, b) => b - a).slice(0, MAX_BLOCKS);
    const mints: ChainMint[] = [];
    let next = 0;
    const worker = async () => {
        while (next < heights.length) {
            const height = heights[next++];
            try {
                const data = await getJson<RpcBlockResults>(`${rpc}/block_results?height=${height}`);
                const events = (data.result?.finalize_block_events ?? data.result?.end_block_events ?? []) as Parameters<typeof parseMintEvents>[0];
                mints.push(...parseMintEvents(events, address, height, blocks.get(height) as number));
            } catch {
                // A block that cannot be read is left out; the next refresh tries again.
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, heights.length) }, worker));
    return mints;
}

async function isProcessed(rest: string, hash: string): Promise<boolean> {
    const data = await getJson<{ processed?: boolean }>(`${rest}/block52/pokerchain/poker/v1/is_tx_processed/${hash}`);
    return data.processed === true;
}

export interface UseBridgeHistoryReturn {
    rows: BridgeRow[];
    isLoading: boolean;
    error: string;
}

/** This address's bridge deposits: the ones this app sent plus everything the chain minted for it. Refreshes while one is still unminted. */
export function useBridgeHistory(address: string, refreshToken = 0): UseBridgeHistoryReturn {
    const { currentNetwork } = useNetwork();
    const [rows, setRows] = useState<BridgeRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async (): Promise<boolean> => {
        const rpc = currentNetwork.rpc.replace(/\/+$/, "");
        const rest = currentNetwork.rest.replace(/\/+$/, "");
        try {
            const [mints, local] = await Promise.all([
                loadMints(rpc, address),
                Promise.all(loadLocalDeposits(address).map(async deposit => ({ ...deposit, processed: await isProcessed(rest, deposit.hash).catch(() => false) })))
            ]);
            setRows(mergeBridgeHistory(local, mints));
            setError("");
            return local.some(deposit => !deposit.processed);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load bridge history");
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [currentNetwork, address]);

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const tick = async () => {
            const pending = await load();
            if (!cancelled && pending) timer = setTimeout(() => void tick(), POLL_MS);
        };
        void tick();
        return () => {
            cancelled = true;
            if (timer !== undefined) clearTimeout(timer);
        };
    }, [load, refreshToken]);

    return { rows, isLoading, error };
}
