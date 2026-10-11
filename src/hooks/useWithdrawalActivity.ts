import { useEffect, useState } from "react";
import { useNetwork } from "../context/NetworkContext";
import { getCosmosClient } from "../utils/cosmos/client";

export type WithdrawalStatus = "pending" | "signed" | "completed";

export interface WithdrawalActivityItem {
    nonce: string;
    toAddress: string;
    amountMicro: string;
    status: WithdrawalStatus;
    createdAt: number | null;
}

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

        const load = async () => {
            try {
                const client = getCosmosClient(currentNetwork);
                if (!client) return;
                const raw: unknown[] = await client.listWithdrawalRequests(address);
                if (cancelled) return;
                const normalized = raw
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
        const interval = setInterval(load, pollMs);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [address, currentNetwork, pollMs, refreshToken]);

    return { items, isLoading, error };
}
