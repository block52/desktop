import { useEffect, useState } from "react";
import { COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import { useNetwork } from "../context/NetworkContext";

export interface WalletTransfer {
    hash: string;
    direction: "in" | "out";
    counterparty: string;
    amountMicro: string;
    timestamp: number | null;
    success: boolean;
}

const LIMIT = 20;

function attributeValue(event: { attributes?: { key: string; value: string }[] }, key: string): string | null {
    const found = event.attributes?.find(a => a.key === key);
    return found === undefined ? null : found.value;
}

/** Turn a tx_response into zero or more USDC transfers touching `address`. */
export function normalizeTransfers(raw: unknown, address: string): WalletTransfer[] {
    if (typeof raw !== "object" || raw === null) return [];
    const t = raw as Record<string, unknown>;
    if (typeof t.txhash !== "string" || !Array.isArray(t.events)) return [];

    const parsed = typeof t.timestamp === "string" ? Date.parse(t.timestamp) : NaN;
    const timestamp = Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
    const success = t.code === 0 || t.code === undefined;
    const suffix = COSMOS_CONSTANTS.TOKEN_DENOM;

    const result: WalletTransfer[] = [];
    for (const event of t.events as { type?: string; attributes?: { key: string; value: string }[] }[]) {
        if (event.type !== "transfer") continue;
        const sender = attributeValue(event, "sender");
        const recipient = attributeValue(event, "recipient");
        const amount = attributeValue(event, "amount");
        if (sender === null || recipient === null || amount === null) continue;
        if (!amount.endsWith(suffix)) continue;
        const amountMicro = amount.slice(0, amount.length - suffix.length);
        if (!/^\d+$/.test(amountMicro)) continue;
        if (recipient === address && sender !== address) {
            result.push({ hash: t.txhash, direction: "in", counterparty: sender, amountMicro, timestamp, success });
        } else if (sender === address && recipient !== address) {
            result.push({ hash: t.txhash, direction: "out", counterparty: recipient, amountMicro, timestamp, success });
        }
    }
    return result;
}

async function fetchByQuery(rest: string, query: string): Promise<unknown[]> {
    const url = `${rest}/cosmos/tx/v1beta1/txs?query=${encodeURIComponent(query)}&pagination.limit=${LIMIT}&order_by=2`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as { tx_responses?: unknown[] };
    return data.tx_responses ?? [];
}

/** Incoming and outgoing USDC transfers for the wallet address, newest first. */
export function useWalletTransfers(
    address: string | null,
    pollMs = 10000,
    refreshToken = 0
): { transfers: WalletTransfer[]; isLoading: boolean; error: string } {
    const { currentNetwork } = useNetwork();
    const [transfers, setTransfers] = useState<WalletTransfer[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (address === null || currentNetwork.rest === "") return;
        let cancelled = false;

        const load = async () => {
            try {
                const rest = currentNetwork.rest;
                const [received, sent] = await Promise.allSettled([
                    fetchByQuery(rest, `transfer.recipient='${address}'`),
                    fetchByQuery(rest, `transfer.sender='${address}'`)
                ]);
                if (cancelled) return;

                if (received.status === "rejected" && sent.status === "rejected") {
                    throw received.reason instanceof Error ? received.reason : new Error("Failed to load transfers");
                }

                const seen = new Set<string>();
                const merged: WalletTransfer[] = [];
                for (const result of [received, sent]) {
                    if (result.status !== "fulfilled") continue;
                    for (const raw of result.value) {
                        for (const transfer of normalizeTransfers(raw, address)) {
                            const key = `${transfer.hash}:${transfer.direction}:${transfer.counterparty}:${transfer.amountMicro}`;
                            if (seen.has(key)) continue;
                            seen.add(key);
                            merged.push(transfer);
                        }
                    }
                }
                merged.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
                setTransfers(merged);
                setError("");
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load transfers");
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

    return { transfers, isLoading, error };
}
