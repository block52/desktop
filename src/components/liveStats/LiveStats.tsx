import React from "react";
import styles from "./LiveStats.module.css";

interface LiveStatsProps {
    openTables: number;
    seatedPlayers: number;
    avgBlockTimeSeconds: number | null;
}

const LiveStats: React.FC<LiveStatsProps> = ({ openTables, seatedPlayers, avgBlockTimeSeconds }) => {
    return (
        <div className={`pane-lite ${styles.card}`}>
            <span className="section-label">Live now</span>
            <div className={styles.row}>
                <div className={styles.stat}>
                    <span className={styles.value}>{openTables}</span>
                    <span className={styles.label}>Open tables</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.value}>{seatedPlayers}</span>
                    <span className={styles.label}>Seated</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.value}>
                        {avgBlockTimeSeconds !== null ? `${avgBlockTimeSeconds.toFixed(1)}s` : "—"}
                    </span>
                    <span className={styles.label}>Avg. block</span>
                </div>
            </div>
        </div>
    );
};

export default LiveStats;
