import styles from "./NodeStats.module.css";

interface NodeStatsProps {
    healthy: number;
    total: number;
    validators: number;
    sync: number;
}

interface Stat {
    label: string;
    value: number;
    valueClass?: string;
}

const NodeStats: React.FC<NodeStatsProps> = ({ healthy, total, validators, sync }) => {
    const stats: Stat[] = [
        { label: "Healthy Nodes", value: healthy, valueClass: styles.valueGreen },
        { label: "Total Nodes", value: total },
        { label: "Validators", value: validators },
        { label: "Sync Nodes", value: sync }
    ];

    return (
        <div className={styles.grid}>
            {stats.map(stat => (
                <div key={stat.label} className={`pane-lite ${styles.card}`}>
                    <span className="section-label">{stat.label}</span>
                    <span className={`${styles.value} ${stat.valueClass ?? ""}`}>{stat.value.toLocaleString()}</span>
                </div>
            ))}
        </div>
    );
};

export default NodeStats;
