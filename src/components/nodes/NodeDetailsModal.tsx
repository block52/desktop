import React, { useEffect, useState } from "react";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { fetchNodeStatus, formatSince, type NodeStatus } from "../../utils/nodeStatus";
import CopyButton from "../copyButton/CopyButton";
import styles from "./NodeDetailsModal.module.css";

const POLL_MS = 15000;

interface NodeDetailsModalProps {
    network: NetworkEndpoints;
    onClose: () => void;
}

interface Loaded {
    status: NodeStatus;
    checkedAt: number;
}

export const NodeDetailsModal: React.FC<NodeDetailsModalProps> = ({ network, onClose }) => {
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const run = async () => {
            const status = await fetchNodeStatus(network.rest, controller.signal);
            if (controller.signal.aborted) return;
            setLoaded({ status, checkedAt: Date.now() });
            timer = setTimeout(() => void run(), POLL_MS);
        };
        void run();
        return () => {
            controller.abort();
            if (timer !== undefined) clearTimeout(timer);
        };
    }, [network.rest, refreshKey]);

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const status = loaded?.status ?? null;
    const checking = loaded === null;

    const rows: Array<[string, string | null]> = [
        ["Block height", status?.blockHeight != null ? `#${Number(status.blockHeight).toLocaleString()}` : null],
        ["Chain ID", status?.chainId ?? null],
        ["Last block", status?.blockTime != null ? new Date(status.blockTime).toLocaleString() : null],
        ["Time since block", status?.blockTime != null ? formatSince(status.blockTime, now) : null],
        ["Node version", status?.nodeVersion ?? null],
        ["Cosmos SDK", status?.cosmosSdkVersion ?? null],
        ["Moniker", status?.moniker ?? null]
    ];

    return (
        <div className={styles.overlay} onClick={onClose} role="presentation">
            <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`${network.name} node status`} onClick={e => e.stopPropagation()}>
                <div className={styles.head}>
                    <h2 className={styles.title}>{network.name}</h2>
                    <span className={`${styles.pill} ${checking ? "" : status?.online === true ? styles.online : styles.offline}`}>
                        {checking ? "Checking…" : status?.online === true ? "Online" : "Offline"}
                    </span>
                    <button type="button" className={styles.refresh} onClick={() => setRefreshKey(key => key + 1)} aria-label="Refresh" title="Refresh">
                        ↻
                    </button>
                </div>
                {status?.syncing === true && <p className={styles.syncing}>Syncing with the network…</p>}

                <dl className={styles.list}>
                    {rows.map(([label, value]) => (
                        <div key={label} className={styles.item}>
                            <dt>{label}</dt>
                            <dd>{value === null ? "—" : value}</dd>
                        </div>
                    ))}
                    <div className={styles.item}>
                        <dt>Last checked</dt>
                        <dd>{loaded === null ? "—" : new Date(loaded.checkedAt).toLocaleTimeString()}</dd>
                    </div>
                </dl>

                <div className={styles.endpoints}>
                    <span className="section-label">Endpoints</span>
                    {(
                        [
                            ["REST", network.rest],
                            ["RPC", network.rpc],
                            ["WebSocket", network.ws],
                            ["gRPC", network.grpc]
                        ] as const
                    ).map(([label, value]) => (
                        <div key={label} className={styles.endpoint}>
                            <span className={styles.endpointLabel}>{label}</span>
                            <code className={styles.endpointValue}>{value}</code>
                            <CopyButton text={value} message={`${label} endpoint copied`} title={`Copy ${label} endpoint`} />
                        </div>
                    ))}
                </div>

                <div className={styles.actions}>
                    <button type="button" className={`btn-ghost ${styles.close}`} onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NodeDetailsModal;
