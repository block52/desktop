import { useWithdrawalActivity, type WithdrawalActivityItem, type WithdrawalStatus } from "../../hooks/useWithdrawalActivity";
import styles from "./ActivityPanel.module.css";

interface ActivityPanelProps {
    address: string;
}

const PILL: Record<WithdrawalStatus, { text: string; className: string }> = {
    completed: { text: "COMPLETED", className: styles.pillCompleted },
    signed: { text: "READY", className: styles.pillSigned },
    pending: { text: "PENDING", className: styles.pillPending }
};

function shortAddr(addr: string): string {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatAmount(micro: string): string {
    return `-$${(Number(micro) / 1_000_000).toFixed(2)}`;
}

const ActivityRow: React.FC<{ item: WithdrawalActivityItem }> = ({ item }) => {
    const pill = PILL[item.status];
    return (
        <div className={styles.row}>
            <div className={styles.typeCell}>
                <span className={styles.typeText}>Withdrawal</span>
                <span className={styles.typeTime}>
                    {item.createdAt !== null ? new Date(item.createdAt * 1000).toLocaleString() : "—"}
                </span>
            </div>
            <span className={styles.detailCell}>
                To {shortAddr(item.toAddress)} · nonce {item.nonce.slice(0, 6)}
            </span>
            <span className={`${styles.pill} ${pill.className}`}>{pill.text}</span>
            <span className={`${styles.amountCell} ${item.status === "pending" ? styles.amountMuted : ""}`}>
                {formatAmount(item.amountMicro)}
            </span>
        </div>
    );
};

const ActivityPanel: React.FC<ActivityPanelProps> = ({ address }) => {
    const { items, isLoading, error } = useWithdrawalActivity(address);

    return (
        <div className={`pane-lite ${styles.panel}`}>
            <div className={styles.gridHeader}>
                <span className="section-label">Type</span>
                <span className="section-label">Detail</span>
                <span className="section-label">Status</span>
                <span className={`section-label ${styles.amountHead}`}>Amount</span>
            </div>

            {isLoading && items.length === 0 && (
                <div className={styles.stateBox}>
                    <div className={styles.spinner} />
                    <p className={styles.stateText}>Loading activity…</p>
                </div>
            )}

            {error !== "" && (
                <div className={styles.stateBox}>
                    <p className={styles.stateText}>{error}</p>
                </div>
            )}

            {error === "" && !isLoading && items.length === 0 && (
                <div className={styles.stateBox}>
                    <p className={styles.stateText}>No activity yet.</p>
                </div>
            )}

            {items.map(item => (
                <ActivityRow key={item.nonce} item={item} />
            ))}
        </div>
    );
};

export default ActivityPanel;
