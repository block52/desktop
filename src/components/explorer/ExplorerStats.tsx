import styles from "./ExplorerStats.module.css";

interface ExplorerStatsProps {
    latestHeight: string | null;
    avgBlockTimeSeconds: number | null;
    accountsCount: number;
    validatorsCount: number | null;
}

const ExplorerStats: React.FC<ExplorerStatsProps> = ({ latestHeight, avgBlockTimeSeconds, accountsCount, validatorsCount }) => (
    <div className={styles.grid}>
        <div className={`pane-lite ${styles.card}`}>
            <span className="section-label">Latest block</span>
            <span className={styles.value}>{latestHeight ?? "—"}</span>
        </div>
        <div className={`pane-lite ${styles.card}`}>
            <span className="section-label">Avg. block time</span>
            <span className={styles.value}>{avgBlockTimeSeconds !== null ? `${avgBlockTimeSeconds.toFixed(1)}s` : "—"}</span>
        </div>
        <div className={`pane-lite ${styles.card}`}>
            <span className="section-label">Accounts</span>
            <span className={styles.value}>{accountsCount.toLocaleString()}</span>
        </div>
        <div className={`pane-lite ${styles.card}`}>
            <span className="section-label">Validators</span>
            <span className={styles.value}>{validatorsCount !== null ? validatorsCount.toLocaleString() : "—"}</span>
        </div>
    </div>
);

export default ExplorerStats;
