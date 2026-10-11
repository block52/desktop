import { useEffect, useState } from "react";
import { useNetwork } from "../context/NetworkContext";

export type WithdrawalStatus = "pending" | "signed" | "completed";

export interface WithdrawalActivityItem {
    nonce: string;
    toAddress: string;
    amountMicro: string;
    status: WithdrawalStatus;
    createdAt: number | null;
}

/** Nodes that answered 501 for the withdrawals endpoint; not asked again this session. */
const unsupportedNodes = new Set<string>();

const COMPLETED_STATUSES = new Set(["completed", "claimed"]);

export function normalizeWithdrawal(raw: unknown): WithdrawalActivityItem | null {
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.nonce !== "string" || typeof r.base_address !== "string" || typeof r.amount !== "string") return null;

    const rawStatus = typeof r.status === "string" ? r.status : "pending";
    const status: WithdrawalStatus = COMPLETED_STATUSES.has(rawStatus)
        ? "completed"
        : rawStatus === "signed"
          ? "signed"
          : "pending";

    const createdRaw = r.created_at;
    const createdAt =
        typeof createdRaw === "number"
            ? createdRaw
            : typeof createdRaw === "string" && createdRaw !== ""
              ? Number(createdRaw)
              : null;

    return {
        nonce: r.nonce,
        toAddress: r.base_address,
        amountMicro: r.amount,
        status,
        createdAt: createdAt !== null && Number.isFinite(createdAt) ? createdAt : null
    };
}

export function useWithdrawalActivity(
    address: string | null,
    pollMs = 10000,
    refreshToken = 0
): { items: WithdrawalActivityItem[]; isLoading: boolean; error: string } {
    const { currentNetwork } = useNetwork();
    const [items, setItems] = useState<WithdrawalActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (address === null) return;
        let cancelled = false;

        const rest = currentNetwork.rest.replace(/\/+$/, "");
        const url = `${rest}/block52/pokerchain/poker/v1/list_withdrawal_requests?cosmos_address=${encodeURIComponent(address)}`;
        if (unsupportedNodes.has(rest)) {
            setItems([]);
            setError("");
            setIsLoading(false);
            return;
        }
        const poll: { id?: ReturnType<typeof setInterval> } = {};

        const load = async () => {
            try {
                const response = await fetch(url);
                if (cancelled) return;
                if (response.status === 501) {
                    // The node does not implement this endpoint: no withdrawals to show, and no point polling it.
                    unsupportedNodes.add(rest);
                    clearInterval(poll.id);
                    setItems([]);
                    setError("");
                    return;
                }
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = (await response.json()) as { withdrawal_requests?: unknown[] };
                if (cancelled) return;
                const normalized = (data.withdrawal_requests ?? [])
                    .map(normalizeWithdrawal)
                    .filter((i): i is WithdrawalActivityItem => i !== null)
                    .sort((a, b) => (b.createdAt ?? -1) - (a.createdAt ?? -1));
                setItems(normalized);
                setError("");
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load activity");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        setIsLoading(true);
        void load();
        poll.id = setInterval(load, pollMs);
        return () => {
            cancelled = true;
            clearInterval(poll.id);
        };
    }, [address, currentNetwork, pollMs, refreshToken]);

    return { items, isLoading, error };
}
