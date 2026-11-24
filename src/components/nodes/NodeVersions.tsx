import React, { useEffect, useState } from "react";
import type { BinaryStatus } from "../../binaries/binaryRelease";
import styles from "./NodeVersions.module.css";

interface Progress {
    received: number;
    total: number | null;
}

/**
 * Installed vs latest versions of the Block52 node binaries (pokerchaind,
 * ws-server), with a Download / Update action that verifies the sha256 before
 * installing (#75).
 */
const NodeVersions: React.FC = () => {
    const [statuses, setStatuses] = useState<BinaryStatus[] | null>(null);
    const [error, setError] = useState<string>("");
    const [busy, setBusy] = useState<string | null>(null);
    const [progress, setProgress] = useState<Record<string, Progress>>({});
    const [rowError, setRowError] = useState<Record<string, string>>({});

    const binaries = window.electronAPI?.binaries;

    const refresh = () => {
        binaries
            ?.status()
            .then(setStatuses)
            .catch(() => setError("Could not read node versions."));
    };

    useEffect(() => {
        if (binaries === undefined) return;
        refresh();
        const unsubscribe = binaries.onProgress(p => setProgress(prev => ({ ...prev, [p.name]: { received: p.received, total: p.total } })));
        return unsubscribe;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [binaries]);

    if (binaries === undefined) return null;

    const onDownload = async (name: string) => {
        setBusy(name);
        setRowError(prev => ({ ...prev, [name]: "" }));
        setProgress(prev => ({ ...prev, [name]: { received: 0, total: null } }));
        try {
            await binaries.download(name);
            refresh();
        } catch (e) {
            setRowError(prev => ({ ...prev, [name]: e instanceof Error ? e.message : "Download failed." }));
        } finally {
            setBusy(null);
            setProgress(prev => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
    };

    return (
        <div className={`pane-lite ${styles.panel}`}>
            <span className="section-label">Node software</span>
            {error !== "" && <p className={styles.error}>{error}</p>}
            {statuses === null && error === "" && <p className={styles.state}>Checking versions…</p>}
            {statuses?.map(s => {
                const canInstall = s.assetName !== null && s.latest !== null && (s.notInstalled || s.updateAvailable);
                const p = progress[s.name];
                return (
                    <div key={s.name} className={styles.row}>
                        <div className={styles.name}>
                            <span className={styles.binary}>{s.name}</span>
                            {s.name === "pokerchaind" && s.installed.engine !== null && (
                                <span className={styles.engine}>engine {s.installed.engine}</span>
                            )}
                        </div>
                        <div className={styles.versions}>
                            <span className={styles.installed}>
                                {s.notInstalled ? "Not installed" : `Installed ${s.installed.version}`}
                            </span>
                            <span className={styles.latest}>
                                {s.latest === null ? "Latest unknown" : `Latest ${s.latest}`}
                            </span>
                            {rowError[s.name] !== undefined && rowError[s.name] !== "" && <span className={styles.error}>{rowError[s.name]}</span>}
                        </div>
                        {busy === s.name ? (
                            <span className={styles.progress}>{formatProgress(p)}</span>
                        ) : canInstall ? (
                            <button type="button" className={`btn-ghost ${styles.action}`} disabled={busy !== null} onClick={() => onDownload(s.name)}>
                                {s.notInstalled ? "Download" : "Update"}
                            </button>
                        ) : (
                            <span className={`${styles.badge} ${badgeClass(s, styles)}`}>{badgeLabel(s)}</span>
                        )}
                    </div>
                );
            })}
            <p className={styles.note}>Downloads are verified against the release checksum before they are installed.</p>
        </div>
    );
};

function formatProgress(p: Progress | undefined): string {
    if (p === undefined) return "Starting…";
    if (p.total === null || p.total === 0) return `${(p.received / 1_000_000).toFixed(1)} MB`;
    return `${Math.round((p.received / p.total) * 100)}%`;
}

function badgeLabel(s: BinaryStatus): string {
    if (s.assetName === null) return "Not available for your platform";
    if (s.notInstalled) return "Not installed";
    if (s.updateAvailable) return "Update available";
    return "Up to date";
}

function badgeClass(s: BinaryStatus, styles: Record<string, string>): string {
    if (s.assetName === null) return styles.badgeMuted;
    if (s.notInstalled || s.updateAvailable) return styles.badgeAttention;
    return styles.badgeOk;
}

export default NodeVersions;
