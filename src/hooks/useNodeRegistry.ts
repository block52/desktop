import { useEffect, useState } from "react";
import { useNetwork } from "../context/NetworkContext";
import type { NetworkEndpoints } from "../context/NetworkContext";
import { getCosmosClient } from "../utils/cosmos/client";

export interface NodeEntry {
    network: NetworkEndpoints;
    online: boolean;
    blockHeight: string | null;
    /** True when this node reports its own voting power (it is a validator). The app only reads it. */
    isValidator: boolean;
    /** This node's own voting power from /status (0 for a non-validating follower). */
    votingPower: number;
    nodeId: string | null;
    /** Its RPC address (`network.rpc`) answered /status. `online` comes from REST, which can answer when RPC doesn't. */
    rpcOnline: boolean;
}

const REGISTRY_POLL_MS = 15000;

/** Health, latest height, and validator/sync role for every given network. */
export function useNodeRegistry(networks: NetworkEndpoints[], pollMs = REGISTRY_POLL_MS): { entries: NodeEntry[]; isLoading: boolean } {
    const [entries, setEntries] = useState<NodeEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const key = (n: NetworkEndpoints) => n.name;

        const load = async () => {
            const results = await Promise.all(
                networks.map(async network => {
                    let online = false;
                    let blockHeight: string | null = null;
                    let isValidator = false;
                    let nodeId: string | null = null;

                    try {
                        const client = getCosmosClient({ rpc: network.rpc, rest: network.rest });
                        if (client) {
                            const blocks = await client.getLatestBlocks(1);
                            if (blocks.length > 0) {
                                online = true;
                                blockHeight = blocks[0].block.header.height;
                            }
                        }
                    } catch {
                        online = false;
                    }

                    try {
                        const infoResponse = await fetch(`${network.rest}/cosmos/base/tendermint/v1beta1/node_info`);
                        if (infoResponse.ok) {
                            const info = (await infoResponse.json()) as {
                                default_node_info?: { default_node_id?: string; id?: string };
                            };
                            const id = info.default_node_info?.default_node_id ?? info.default_node_info?.id;
                            if (typeof id === "string" && id !== "") {
                                nodeId = id;
                            }
                        }
                    } catch {
                        nodeId = null;
                    }

                    // Whether THIS node is a validator — its own voting power from
                    // /status, not the chain-wide validator list (which is non-empty
                    // for every network). The app only reads it: a validator node is a
                    // data source we label as such, never something we control (#74).
                    let votingPower = 0;
                    let rpcOnline = false;
                    try {
                        const statusResponse = await fetch(`${network.rpc.replace(/\/+$/, "")}/status`);
                        if (statusResponse.ok) {
                            const status = (await statusResponse.json()) as {
                                result?: { validator_info?: { voting_power?: string } };
                            };
                            rpcOnline = status.result !== undefined;
                            const power = Number(status.result?.validator_info?.voting_power ?? "0");
                            votingPower = Number.isFinite(power) ? power : 0;
                            isValidator = votingPower > 0;
                        }
                    } catch {
                        isValidator = false;
                        rpcOnline = false;
                    }

                    return { network, online, blockHeight, isValidator, votingPower, nodeId, rpcOnline };
                })
            );

            if (cancelled) return;
            setEntries(prev => {
                const prevByName = new Map(prev.map(e => [key(e.network), e]));
                const known = new Set(networks.map(key));
                // Drop removed networks, keep entry order stable by network list order.
                const next = results.map(r => {
                    const existing = prevByName.get(key(r.network));
                    return existing !== undefined ? r : r;
                });
                return next.filter(e => known.has(key(e.network)));
            });
            setIsLoading(false);
        };

        setIsLoading(true);
        void load();
        const interval = setInterval(load, pollMs);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [networks, pollMs]);

    return { entries, isLoading };
}

export interface ValidatorEarning {
    operatorAddress: string;
    moniker: string;
    bondedUsdc: number;
}

export function normalizeValidatorEarning(raw: unknown): ValidatorEarning | null {
    if (typeof raw !== "object" || raw === null) return null;
    const v = raw as Record<string, unknown>;
    if (typeof v.operator_address !== "string" || typeof v.tokens !== "string") return null;
    const tokens = Number(v.tokens);
    if (!Number.isFinite(tokens)) return null;
    const description = v.description as Record<string, unknown> | undefined;
    return {
        operatorAddress: v.operator_address,
        moniker: typeof description?.moniker === "string" ? description.moniker : "Unknown",
        bondedUsdc: tokens / 1_000_000
    };
}

/** Bonded validators on the current network, sorted by bond size desc. */
export function useValidatorEarnings(): { validators: ValidatorEarning[]; isLoading: boolean; error: string } {
    const { currentNetwork } = useNetwork();
    const [validators, setValidators] = useState<ValidatorEarning[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (currentNetwork.rest === "") return;
        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            setError("");
            try {
                const response = await fetch(
                    `${currentNetwork.rest}/cosmos/staking/v1beta1/validators?pagination.limit=100`
                );
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = (await response.json()) as { validators?: unknown[] };
                if (cancelled) return;
                const list = (data.validators ?? [])
                    .map(normalizeValidatorEarning)
                    .filter((v): v is ValidatorEarning => v !== null)
                    .sort((a, b) => b.bondedUsdc - a.bondedUsdc);
                setValidators(list);
            } catch (err) {
                if (!cancelled) {
                    setValidators([]);
                    setError(err instanceof Error ? err.message : "Failed to load validators");
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [currentNetwork]);

    return { validators, isLoading, error };
}
