import { useEffect, useState } from "react";
import { useNetwork } from "../context/NetworkContext";

export interface AccountTx {
    hash: string;
    height: string;
    timestamp: string;
    success: boolean;
}

/** Newest transactions fetched per direction; the explorer pages through them client-side. */
const LIMIT = 60;

export function normalizeAccountTx(raw: unknown): AccountTx | null {
    if (typeof raw !== "object" || raw === null) return null;
    const t = raw as Record<string, unknown>;
    if (typeof t.txhash !== "string" || typeof t.height !== "string") return null;
    return {
        hash: t.txhash,
        height: t.height,
        timestamp: typeof t.timestamp === "string" ? t.timestamp : "",
        success: t.code === 0 || t.code === undefined
    };
}

async function fetchByQuery(rest: string, query: string): Promise<unknown[]> {
    const url = `${rest}/cosmos/tx/v1beta1/txs?query=${encodeURIComponent(query)}&pagination.limit=${LIMIT}&order_by=2`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as { tx_responses?: unknown[] };
    return data.tx_responses ?? [];
}

/** Transactions where the address is sender or recipient; newest first, capped at 10. */
export function useAccountTransactions(address: string | null): { txs: AccountTx[]; isLoading: boolean; error: string } {
    const { currentNetwork } = useNetwork();
    const [txs, setTxs] = useState<AccountTx[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (address === null || currentNetwork.rest === "") return;
        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            setError("");
            try {
                const rest = currentNetwork.rest;
                const [sent, received] = await Promise.allSettled([
                    fetchByQuery(rest, `message.sender='${address}'`),
                    fetchByQuery(rest, `transfer.recipient='${address}'`)
                ]);

                if (cancelled) return;

                if (sent.status === "rejected" && received.status === "rejected") {
                    const err = sent.reason instanceof Error ? sent.reason : new Error("Failed to load transactions");
                    throw err;
                }

                const merged = new Map<string, AccountTx>();
                for (const result of [sent, received]) {
                    if (result.status !== "fulfilled") continue;
                    for (const raw of result.value) {
                        const tx = normalizeAccountTx(raw);
                        if (tx !== null && !merged.has(tx.hash)) merged.set(tx.hash, tx);
                    }
                }

                const sorted = [...merged.values()].sort((a, b) => Number(b.height) - Number(a.height)).slice(0, LIMIT);
                setTxs(sorted);
            } catch (err) {
                if (!cancelled) {
                    setTxs([]);
                    setError(err instanceof Error ? err.message : "Failed to load transactions");
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [address, currentNetwork]);

    return { txs, isLoading, error };
}
