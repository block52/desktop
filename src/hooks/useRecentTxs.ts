import { useEffect, useState } from "react";
import { useNetwork } from "../context/NetworkContext";

export interface RecentTx {
    hash: string;
    height: string;
    /** Humanised message type, e.g. "Record Eth Block Height". */
    type: string;
    success: boolean;
}

const POLL_MS = 10000;

interface RawEvent {
    type?: string;
    attributes?: { key?: string; value?: string }[];
}

interface RawTx {
    hash?: string;
    height?: string;
    tx_result?: { code?: number; events?: RawEvent[] };
}

/** "/pokerchain.poker.v1.MsgRecordEthBlockHeight" → "Record Eth Block Height". */
export function humaniseMsgType(action: string): string {
    const short = action.split(".").pop() ?? action;
    return short
        .replace(/^Msg/, "")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .trim();
}

export function normalizeRecentTx(raw: RawTx): RecentTx | null {
    if (typeof raw.hash !== "string" || typeof raw.height !== "string") return null;
    const actions: string[] = [];
    for (const event of raw.tx_result?.events ?? []) {
        if (event.type !== "message") continue;
        for (const attr of event.attributes ?? []) {
            if (attr.key === "action" && typeof attr.value === "string") actions.push(attr.value);
        }
    }
    return {
        hash: raw.hash,
        height: raw.height,
        type: actions.length > 0 ? humaniseMsgType(actions[0]) : "Transaction",
        success: raw.tx_result?.code === undefined || raw.tx_result.code === 0
    };
}

/** Newest chain transactions (CometBFT tx_search, newest first). */
export function useRecentTxs(page = 1, pageSize = 15): { txs: RecentTx[]; total: number; isLoading: boolean; error: string } {
    const { currentNetwork } = useNetwork();
    const [txs, setTxs] = useState<RecentTx[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState("");

    useEffect(() => {
        if (currentNetwork.rpc === "") return;
        let cancelled = false;
        const load = async () => {
            try {
                const rpc = currentNetwork.rpc.replace(/\/+$/, "");
                const url = `${rpc}/tx_search?query=${encodeURIComponent("\"tx.height>0\"")}&page=${page}&per_page=${pageSize}&order_by=${encodeURIComponent("\"desc\"")}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = (await response.json()) as { result?: { txs?: RawTx[]; total_count?: string } };
                if (cancelled) return;
                const list = (data.result?.txs ?? []).map(normalizeRecentTx).filter((t): t is RecentTx => t !== null);
                setTxs(list);
                setTotal(Number(data.result?.total_count ?? list.length));
                setError("");
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load transactions");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        void load();
        const interval = setInterval(load, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [currentNetwork, page, pageSize]);

    return { txs, total, isLoading, error };
}
