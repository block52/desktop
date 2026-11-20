import React, { useEffect, useState } from "react";
import type { BinaryStatus } from "../../binaries/binaryRelease";
import styles from "./NodeVersions.module.css";

/**
 * Installed vs latest versions of the Block52 node binaries (pokerchaind,
 * ws-server), with an "update available" / "not installed" indicator (#75).
 * Read-only: this reports versions; downloading/installing is a follow-up.
 */
const NodeVersions: React.FC = () => {
    const [statuses, setStatuses] = useState<BinaryStatus[] | null>(null);
    const [error, setError] = useState<string>("");

    const binaries = window.electronAPI?.binaries;

    useEffect(() => {
        if (binaries === undefined) return;
        let active = true;
        binaries
            .status()
            .then(s => active && setStatuses(s))
            .catch(() => active && setError("Could not read node versions."));
        return () => {
            active = false;
        };
    }, [binaries]);

    if (binaries === undefined) return null;

    return (
        <div className={`pane-lite ${styles.panel}`}>
            <span className="section-label">Node software</span>
            {error !== "" && <p className={styles.error}>{error}</p>}
            {statuses === null && error === "" && <p className={styles.state}>Checking versions…</p>}
            {statuses?.map(s => (
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
                    </div>
                    <span className={`${styles.badge} ${badgeClass(s, styles)}`}>{badgeLabel(s)}</span>
                </div>
            ))}
            <p className={styles.note}>The app reads versions only. Download and install arrives in a later update.</p>
        </div>
    );
};

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
