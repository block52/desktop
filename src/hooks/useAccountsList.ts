import { useEffect, useMemo, useState } from "react";
import { fromBech32, toBech32 } from "@cosmjs/encoding";
import { useNetwork } from "../context/NetworkContext";

export interface AccountListItem {
    address: string;
    /** Auth account kind, e.g. "B52 Account". */
    type: string;
    /** Most recent sent/received tx time (ISO); null until resolved or if none. */
    lastActive: string | null;
    usdcValue: number;
    balances: { denom: string; amount: string }[];
    validatorMoniker: string | null;
    validatorStatus: string | null;
}

export interface AccountsListState {
    accounts: AccountListItem[];
    total: number;
    isLoading: boolean;
    error: string;
}

const POLL_MS = 60000;
const FETCH_LIMIT = 100;
const ACTIVITY_BATCH = 5;

/** "/cosmos.auth.v1beta1.BaseAccount" → "B52 Account"; other kinds keep their short name. */
export function accountTypeLabel(account: unknown): string {
    if (typeof account !== "object" || account === null) return "Unknown";
    const raw = (account as Record<string, unknown>)["@type"];
    if (typeof raw !== "string") return "Unknown";
    const short = raw.split(".").pop();
    if (short === undefined || short === "") return "Unknown";
    return short === "BaseAccount" ? "B52 Account" : short;
}

/** Newest timestamp among the given ISO strings, or null. */
export function latestTimestamp(timestamps: (string | undefined)[]): string | null {
    let latest: string | null = null;
    let latestMs = -Infinity;
    for (const t of timestamps) {
        if (t === undefined) continue;
        const ms = Date.parse(t);
        if (Number.isNaN(ms) || ms <= latestMs) continue;
        latest = t;
        latestMs = ms;
    }
    return latest;
}

async function fetchLastActive(rest: string, address: string): Promise<string | null> {
    const newest = async (query: string): Promise<string | undefined> => {
        const url = `${rest}/cosmos/tx/v1beta1/txs?query=${encodeURIComponent(query)}&pagination.limit=1&order_by=2`;
        const response = await fetch(url);
        if (!response.ok) return undefined;
        const data = (await response.json()) as { tx_responses?: { timestamp?: string }[] };
        return data.tx_responses?.[0]?.timestamp;
    };
    try {
        const [sent, received] = await Promise.all([newest(`message.sender='${address}'`), newest(`transfer.recipient='${address}'`)]);
        return latestTimestamp([sent, received]);
    } catch {
        return null;
    }
}

/** Flat / nested account address extraction, "" when none. */
export function extractAccountAddress(account: unknown): string {
    if (typeof account !== "object" || account === null) return "";
    const a = account as Record<string, unknown>;
    if (typeof a.address === "string") return a.address;
    const base = a.base_account;
    if (typeof base === "object" && base !== null && typeof (base as Record<string, unknown>).address === "string") {
        return (base as Record<string, unknown>).address as string;
    }
    return "";
}

/** Sum usdc/uusdc balances (micro) into whole-dollar USDC. */
export function computeUsdcValue(balances: unknown): number {
    if (!Array.isArray(balances)) return 0;
    let total = 0;
    for (const b of balances) {
        if (typeof b !== "object" || b === null) continue;
        const balance = b as Record<string, unknown>;
        if (balance.denom !== "usdc" && balance.denom !== "uusdc") continue;
        const amount = Number(balance.amount);
        if (Number.isFinite(amount)) total += amount / 1_000_000;
    }
    return total;
}

/** Keep only well-formed denom/amount coin entries. */
export function sanitizeBalances(balances: unknown): { denom: string; amount: string }[] {
    if (!Array.isArray(balances)) return [];
    const result: { denom: string; amount: string }[] = [];
    for (const b of balances) {
        if (typeof b !== "object" || b === null) continue;
        const balance = b as Record<string, unknown>;
        if (typeof balance.denom === "string" && typeof balance.amount === "string") {
            result.push({ denom: balance.denom, amount: balance.amount });
        }
    }
    return result;
}

/** Convert a validator operator address (b52valoper...) to its account address (b521...). */
export function valoperToAccount(valoperAddr: string): string {
    try {
        const decoded = fromBech32(valoperAddr);
        const basePrefix = decoded.prefix.replace("valoper", "");
        return toBech32(basePrefix, decoded.data);
    } catch {
        return "";
    }
}

async function fetchJson(url: string): Promise<unknown> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

export function useAccountsList(): AccountsListState {
    const { currentNetwork } = useNetwork();
    const [state, setState] = useState<AccountsListState>({ accounts: [], total: 0, isLoading: true, error: "" });
    // address → last active, kept across polls so the column doesn't flicker.
    const [activity, setActivity] = useState<Map<string, string | null>>(new Map());

    useEffect(() => {
        if (currentNetwork.rest === "") return;
        let cancelled = false;

        const load = async () => {
            try {
                const rest = currentNetwork.rest;

                // Validators first so accounts can be flagged with monikers.
                const validatorMap = new Map<string, { moniker: string; status: string }>();
                try {
                    const validatorsData = (await fetchJson(`${rest}/cosmos/staking/v1beta1/validators?pagination.limit=${FETCH_LIMIT}`)) as {
                        validators?: { operator_address?: string; description?: { moniker?: string }; status?: string }[];
                    };
                    for (const v of validatorsData.validators ?? []) {
                        if (typeof v.operator_address !== "string") continue;
                        const accountAddress = valoperToAccount(v.operator_address);
                        if (accountAddress === "") continue;
                        validatorMap.set(accountAddress, {
                            moniker: v.description?.moniker ?? "Unknown",
                            status: v.status?.replace("BOND_STATUS_", "") ?? "Unknown"
                        });
                    }
                } catch {
                    // Validator metadata is a nicety — accounts still render without it.
                }

                const accountsData = (await fetchJson(`${rest}/cosmos/auth/v1beta1/accounts?pagination.limit=${FETCH_LIMIT}`)) as {
                    accounts?: unknown[];
                };
                const rawAccounts = accountsData.accounts ?? [];

                const items: AccountListItem[] = await Promise.all(
                    rawAccounts.map(async account => {
                        const address = extractAccountAddress(account);
                        let usdcValue = 0;
                        let balances: { denom: string; amount: string }[] = [];
                        if (address !== "") {
                            try {
                                const balanceData = (await fetchJson(`${rest}/cosmos/bank/v1beta1/balances/${address}`)) as {
                                    balances?: unknown;
                                };
                                balances = sanitizeBalances(balanceData.balances);
                                usdcValue = computeUsdcValue(balanceData.balances);
                            } catch {
                                // Unparseable balance counts as zero rather than failing the list.
                            }
                        }
                        const validator = validatorMap.get(address);
                        return {
                            address,
                            type: accountTypeLabel(account),
                            lastActive: null,
                            usdcValue,
                            balances,
                            validatorMoniker: validator?.moniker ?? null,
                            validatorStatus: validator?.status ?? null
                        };
                    })
                );

                if (cancelled) return;
                const valid = items.filter(i => i.address !== "").sort((a, b) => b.usdcValue - a.usdcValue);
                // Last-active needs two tx searches per account: resolve in small
                // batches after the list is already on screen.
                void (async () => {
                    for (let i = 0; i < valid.length; i += ACTIVITY_BATCH) {
                        const batch = valid.slice(i, i + ACTIVITY_BATCH);
                        const results = await Promise.all(batch.map(a => fetchLastActive(rest, a.address)));
                        if (cancelled) return;
                        setActivity(prev => {
                            const next = new Map(prev);
                            batch.forEach((a, idx) => next.set(a.address, results[idx]));
                            return next;
                        });
                    }
                })();
                setState({
                    accounts: valid,
                    total: valid.length,
                    isLoading: false,
                    error: ""
                });
            } catch (err) {
                if (!cancelled) {
                    setState({
                        accounts: [],
                        total: 0,
                        isLoading: false,
                        error: err instanceof Error ? err.message : "Failed to load accounts"
                    });
                }
            }
        };

        setState(prev => ({ ...prev, isLoading: true }));
        void load();
        const interval = setInterval(load, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [currentNetwork]);

    const accounts = useMemo(
        () => state.accounts.map(a => ({ ...a, lastActive: activity.get(a.address) ?? null })),
        [state.accounts, activity]
    );

    return { ...state, accounts };
}
