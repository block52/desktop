import { useCallback, useEffect, useMemo, useState } from "react";
import { createSigningClientFromMnemonic, COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import { useNetwork } from "../../context/NetworkContext";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { useNodeRegistry, useValidatorEarnings } from "../../hooks/useNodeRegistry";
import { useCosmosWallet } from "../../hooks/useCosmosWallet";
import { useToast } from "../../context/ToastContext";
import { getCosmosClient } from "../../utils/cosmos/client";
import { getCosmosMnemonic } from "../../utils/cosmos/storage";
import NodeStats from "../../components/nodes/NodeStats";
import RunNodeGuide, { buildSeeds } from "../../components/nodes/RunNodeGuide";
import NodeDetailsModal from "../../components/nodes/NodeDetailsModal";
import BondValidatorForm, { type BondPayload } from "../../components/nodes/BondValidatorForm";
import styles from "./Nodes.module.css";

const XIcon: React.FC = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </svg>
);

const ServerIcon: React.FC = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" />
        <path d="M6 6h.01" />
        <path d="M6 18h.01" />
    </svg>
);

type NodesTab = "nodes" | "run" | "validator";

const TABS: { key: NodesTab; label: string }[] = [
    { key: "nodes", label: "Nodes" },
    { key: "run", label: "Run a Node" },
    { key: "validator", label: "Become a Validator" }
];

function shortOper(address: string): string {
    return `${address.slice(0, 14)}…${address.slice(-6)}`;
}

const Nodes: React.FC = () => {
    const { currentNetwork, setNetwork, availableNetworks, discoveredNetworks, removeDiscoveredNetwork } =
        useNetwork();
    const { balance } = useCosmosWallet();
    const { showSuccess, showError } = useToast();

    const [tab, setTab] = useState<NodesTab>("nodes");
    const [detailsNetwork, setDetailsNetwork] = useState<NetworkEndpoints | null>(null);

    const allNetworks = useMemo(
        () => [...availableNetworks, ...discoveredNetworks],
        [availableNetworks, discoveredNetworks]
    );
    const { entries } = useNodeRegistry(allNetworks);
    const { validators: validatorEarnings, isLoading: earningsLoading, error: earningsError } = useValidatorEarnings();
    const entryByName = useMemo(() => new Map(entries.map(e => [e.network.name, e])), [entries]);

    /* ── Run a Node live data ── */
    const [chainVersion, setChainVersion] = useState("0.1.73");
    const [minBondUsdc, setMinBondUsdc] = useState(10);
    const [trustPoint, setTrustPoint] = useState<{ height: string; hash: string } | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const response = await fetch(`${currentNetwork.rest}/cosmos/base/tendermint/v1beta1/node_info`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = (await response.json()) as {
                    default_node_info?: { version?: string };
                    application_version?: { version?: string };
                };
                const version = data.application_version?.version ?? data.default_node_info?.version;
                if (!cancelled && typeof version === "string") {
                    setChainVersion(version);
                }
            } catch {
                // Keep the last known version.
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [currentNetwork]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const response = await fetch(`${currentNetwork.rest}/block52/pokerchain/poker/v1/params`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = (await response.json()) as { params?: { min_validator_bond?: string } };
                const micro = Number(data.params?.min_validator_bond);
                if (!cancelled && Number.isFinite(micro) && micro > 0) setMinBondUsdc(micro / 1_000_000);
            } catch {
                // Keep the default minimum.
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [currentNetwork]);

    useEffect(() => {
        setTrustPoint(null);
        let cancelled = false;
        const load = async () => {
            try {
                const client = getCosmosClient(currentNetwork);
                if (!client) return;
                const latest = await client.getLatestBlocks(1);
                if (latest.length === 0) return;
                const trustHeight = Number(latest[0].block.header.height) - 1000;
                const block = await client.getBlock(trustHeight);
                if (!cancelled) setTrustPoint({ height: trustHeight.toString(), hash: block.block_id.hash });
            } catch {
                // Guide shows its loading state until a trust point is available.
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [currentNetwork]);

    const seedNodes = useMemo(
        () =>
            entries
                .filter(e => e.online && e.nodeId !== null)
                .map(e => ({ host: new URL(e.network.rest).hostname, nodeId: e.nodeId })),
        [entries]
    );
    const seeds = useMemo(() => buildSeeds(seedNodes), [seedNodes]);
    const rpcServers = useMemo(() => seedNodes.map(n => `http://${n.host}:26657`).join(","), [seedNodes]);

    /* ── Bond validator ── */
    const [isBonding, setIsBonding] = useState(false);
    const [bondError, setBondError] = useState("");
    const [bondHash, setBondHash] = useState("");

    const walletBalanceUsdc = useMemo(() => {
        const micro = balance.find(b => b.denom === COSMOS_CONSTANTS.TOKEN_DENOM)?.amount ?? "0";
        return Number(micro) / 1_000_000;
    }, [balance]);
    const totalBondedUsdc = useMemo(() => validatorEarnings.reduce((sum, v) => sum + v.bondedUsdc, 0), [validatorEarnings]);

    const handleBond = useCallback(
        async (payload: BondPayload) => {
            setIsBonding(true);
            setBondError("");
            try {
                const mnemonic = getCosmosMnemonic();
                if (mnemonic === null) throw new Error("Create or import a wallet before bonding a validator.");

                const client = await createSigningClientFromMnemonic(
                    {
                        rpcEndpoint: currentNetwork.rpc,
                        restEndpoint: currentNetwork.rest,
                        chainId: COSMOS_CONSTANTS.CHAIN_ID,
                        prefix: COSMOS_CONSTANTS.ADDRESS_PREFIX,
                        denom: COSMOS_CONSTANTS.GAS_DENOM,
                        gasPrice: COSMOS_CONSTANTS.DEFAULT_GAS_PRICE
                    },
                    mnemonic
                );

                const hash = await client.createValidator({
                    consensusPubkeyBase64: payload.consensusPubkeyBase64,
                    amount: payload.amountMicro,
                    denom: COSMOS_CONSTANTS.TOKEN_DENOM,
                    moniker: payload.moniker,
                    website: payload.website !== "" ? payload.website : undefined,
                    securityContact: payload.securityContact !== "" ? payload.securityContact : undefined,
                    details: payload.details !== "" ? payload.details : undefined,
                    commissionRate: payload.commissionRate,
                    commissionMaxRate: payload.commissionMaxRate,
                    commissionMaxChangeRate: payload.commissionMaxChangeRate,
                    minSelfDelegation: payload.amountMicro
                });
                setBondHash(hash);
                showSuccess("Validator bonded");
            } catch (err) {
                const message = err instanceof Error ? err.message : "Bond failed";
                setBondError(message);
                showError(message);
            } finally {
                setIsBonding(false);
            }
        },
        [currentNetwork, showSuccess, showError]
    );

    const healthy = entries.filter(e => e.online).length;
    const total = entries.length;
    const validatorsCount = earningsError === "" ? validatorEarnings.length : entries.filter(e => e.isValidator).length;
    const syncCount = entries.filter(e => !e.isValidator).length;

    const renderNodeRow = (network: NetworkEndpoints, canRemove: boolean) => {
        const entry = entryByName.get(network.name);
        const online = entry?.online ?? false;
        const isValidator = entry?.isValidator ?? false;
        const height = entry?.blockHeight;
        return (
            <div key={network.name} className={styles.row}>
                <div className={styles.nodeCell}>
                    <div className={styles.nodeIcon}>
                        <ServerIcon />
                    </div>
                    <div className={styles.nodeText}>
                        <span className={styles.nodeName}>{network.name}</span>
                    </div>
                </div>
                <span className={`${styles.rolePill} ${isValidator ? styles.roleValidator : styles.roleSync}`}>
                    {isValidator ? "Validator" : "Sync"}
                </span>
                <span className={`${styles.statusPill} ${online ? styles.statusOnline : styles.statusOffline}`}>
                    {online ? "Online" : "Offline"}
                </span>
                <span className={styles.heightCell}>
                    {online && height !== null && height !== undefined ? `#${Number(height).toLocaleString()}` : "—"}
                </span>
                <span className={styles.endpointCell}>{network.rest}</span>
                <div className={styles.rowActions}>
                    <button className={`btn-ghost ${styles.switchButton}`} onClick={() => setDetailsNetwork(network)}>
                        Details
                    </button>
                    {network.name === currentNetwork.name ? (
                        <span className={styles.activeBadge}>Active</span>
                    ) : (
                        <button
                            className={`btn-ghost ${styles.switchButton}`}
                            onClick={() => setNetwork(network)}
                        >
                            Switch
                        </button>
                    )}
                    {canRemove && (
                        <button
                            className={styles.removeButton}
                            onClick={() => removeDiscoveredNetwork(network.name)}
                            title={`Remove ${network.name}`}
                        >
                            <XIcon />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>Nodes</h1>
                <p className={styles.subtitle}>The validators and RPC nodes running the Poker VM.</p>
            </div>

            <div className={styles.tabBar} role="tablist">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        role="tab"
                        aria-selected={tab === t.key}
                        className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
                        onClick={() => setTab(t.key)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === "nodes" && (
                <>
                    <NodeStats healthy={healthy} total={total} validators={validatorsCount} sync={syncCount} />

                    <div className={`pane-lite ${styles.panel}`}>
                        <div className={styles.panelHeader}>
                            <span className="section-label">Preset Nodes</span>
                            <span className={styles.panelCount}>{availableNetworks.length}</span>
                        </div>
                        <div className={styles.gridHeader}>
                            <span className="section-label">Name</span>
                            <span className="section-label">Type</span>
                            <span className="section-label">Status</span>
                            <span className="section-label">Block Height</span>
                            <span className="section-label">Endpoint</span>
                            <span />
                        </div>
                        {availableNetworks.map(network => renderNodeRow(network, false))}
                    </div>

                    <div className={`pane-lite ${styles.panel}`}>
                        <div className={styles.panelHeader}>
                            <span className="section-label">Validator Earnings</span>
                        </div>
                        <div className={styles.earningHeader}>
                            <span className="section-label">Validator</span>
                            <span className="section-label">Bonded USDC (split weight)</span>
                            <span className="section-label">Protocol-fee Earnings</span>
                        </div>
                        {earningsLoading && validatorEarnings.length === 0 && (
                            <div className={styles.stateBox}>
                                <div className={styles.spinner} />
                                <p className={styles.stateText}>Loading validators…</p>
                            </div>
                        )}
                        {earningsError !== "" && (
                            <div className={styles.stateBox}>
                                <p className={styles.stateText}>{earningsError}</p>
                            </div>
                        )}
                        {earningsError === "" && !earningsLoading && validatorEarnings.length === 0 && (
                            <div className={styles.stateBox}>
                                <p className={styles.stateText}>No validators on {currentNetwork.name}.</p>
                            </div>
                        )}
                        {validatorEarnings.map(v => (
                            <div key={v.operatorAddress} className={styles.earningRow}>
                                <div className={styles.nodeText}>
                                    <span className={styles.nodeName}>{v.moniker}</span>
                                    <span className={styles.nodeEndpoints}>{shortOper(v.operatorAddress)}</span>
                                </div>
                                <span className={styles.earningValue}>${v.bondedUsdc.toFixed(2)}</span>
                                <span className={styles.earningSoon}>Coming soon</span>
                            </div>
                        ))}
                    </div>

                    <div className={`pane-lite ${styles.panel}`}>
                        <div className={styles.panelHeader}>
                            <span className="section-label">Discovered Nodes</span>
                            <span className={styles.panelCount}>{discoveredNetworks.length}</span>
                        </div>
                        {discoveredNetworks.length === 0 ? (
                            <div className={styles.stateBox}>
                                <p className={styles.stateText}>No discovered nodes yet.</p>
                            </div>
                        ) : (
                            <>
                                <div className={styles.gridHeader}>
                                    <span className="section-label">Name</span>
                                    <span className="section-label">Type</span>
                                    <span className="section-label">Status</span>
                                    <span className="section-label">Block Height</span>
                                    <span className="section-label">Endpoint</span>
                                    <span />
                                </div>
                                {discoveredNetworks.map(network => renderNodeRow(network, true))}
                            </>
                        )}
                    </div>
                </>
            )}

            {tab === "run" &&
                (trustPoint !== null && seeds !== "" ? (
                    <RunNodeGuide
                        chainVersion={chainVersion}
                        genesisUrl={`${currentNetwork.rest}/genesis`}
                        seeds={seeds}
                        rpcServers={rpcServers}
                        trustHeight={trustPoint.height}
                        trustHash={trustPoint.hash}
                    />
                ) : (
                    <div className={`pane-lite ${styles.stateBox}`}>
                        <div className={styles.spinner} />
                        <p className={styles.stateText}>Reading node and chain info…</p>
                    </div>
                ))}

            {tab === "validator" && (
                <BondValidatorForm
                    walletBalanceUsdc={walletBalanceUsdc}
                    minBondUsdc={minBondUsdc}
                    totalBondedUsdc={totalBondedUsdc}
                    onBond={handleBond}
                    isBonding={isBonding}
                    error={bondError}
                    resultHash={bondHash}
                />
            )}

            {detailsNetwork !== null && <NodeDetailsModal network={detailsNetwork} onClose={() => setDetailsNetwork(null)} />}
        </div>
    );
};

export default Nodes;
