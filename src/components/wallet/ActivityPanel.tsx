import { useCallback, useState } from "react";
import { useWithdrawalActivity, type WithdrawalActivityItem, type WithdrawalStatus } from "../../hooks/useWithdrawalActivity";
import { useWalletTransfers, type WalletTransfer } from "../../hooks/useWalletTransfers";
import { usePaidOutWithdrawals } from "../../hooks/usePaidOutWithdrawals";
import PendingWithdrawals from "./PendingWithdrawals";
import styles from "./ActivityPanel.module.css";

interface ActivityPanelProps {
    address: string;
    refreshToken?: number;
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

function formatMicro(micro: string): string {
    return (Number(micro) / 1_000_000).toFixed(2);
}

const TransferRow: React.FC<{ transfer: WalletTransfer }> = ({ transfer }) => {
    const incoming = transfer.direction === "in";
    return (
        <div className={styles.row}>
            <div className={styles.typeCell}>
                <span className={styles.typeText}>{incoming ? "Received" : "Sent"}</span>
                <span className={styles.typeTime}>
                    {transfer.timestamp !== null ? new Date(transfer.timestamp * 1000).toLocaleString() : "—"}
                </span>
            </div>
            <span className={styles.detailCell}>
                {incoming ? "From" : "To"} {shortAddr(transfer.counterparty)}
            </span>
            <span className={`${styles.pill} ${transfer.success ? styles.pillCompleted : styles.pillPending}`}>
                {transfer.success ? "CONFIRMED" : "FAILED"}
            </span>
            <span className={styles.amountCell}>
                {incoming ? "+" : "-"}${formatMicro(transfer.amountMicro)}
            </span>
        </div>
    );
};

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

type FeedEntry =
    | { kind: "withdrawal"; key: string; time: number; item: WithdrawalActivityItem }
    | { kind: "transfer"; key: string; time: number; transfer: WalletTransfer };

const ActivityPanel: React.FC<ActivityPanelProps> = ({ address, refreshToken = 0 }) => {
    const [completedCount, setCompletedCount] = useState(0);
    const refresh = useCallback(() => setCompletedCount(count => count + 1), []);
    const token = refreshToken + completedCount;
    const withdrawals = useWithdrawalActivity(address, undefined, token);
    const transfers = useWalletTransfers(address, undefined, token);

    const paidOut = usePaidOutWithdrawals(withdrawals.items, token);
    const settled = withdrawals.items.map(item => (paidOut.has(item.nonce) ? { ...item, status: "completed" as const } : item));
    const inProgress = settled.filter(item => item.status !== "completed");
    const history = settled.filter(item => item.status === "completed");

    // Each withdrawal also shows up as a send to the bridge account at the same moment; it is the same event, so it is listed once.
    const isWithdrawalSend = (transfer: WalletTransfer) =>
        transfer.direction === "out" &&
        withdrawals.items.some(
            item =>
                item.amountMicro === transfer.amountMicro &&
                item.createdAt !== null &&
                transfer.timestamp !== null &&
                Math.abs(item.createdAt - transfer.timestamp) <= 120
        );

    const entries: FeedEntry[] = [
        ...history.map(item => ({ kind: "withdrawal" as const, key: `w-${item.nonce}`, time: item.createdAt ?? 0, item })),
        ...transfers.transfers.filter(transfer => !isWithdrawalSend(transfer)).map((transfer, i) => ({
            kind: "transfer" as const,
            key: `t-${transfer.hash}-${i}`,
            time: transfer.timestamp ?? 0,
            transfer
        }))
    ].sort((a, b) => b.time - a.time);

    const isLoading = withdrawals.isLoading || transfers.isLoading;
    const error = withdrawals.error !== "" ? withdrawals.error : transfers.error;
    const showError = error !== "" && entries.length === 0;

    return (
        <>
        <PendingWithdrawals items={inProgress} onCompleted={refresh} />
        <div className={`pane-lite ${styles.panel}`}>
            <div className={styles.gridHeader}>
                <span className="section-label">Type</span>
                <span className="section-label">Detail</span>
                <span className="section-label">Status</span>
                <span className={`section-label ${styles.amountHead}`}>Amount</span>
            </div>

            {isLoading && entries.length === 0 && (
                <div className={styles.stateBox}>
                    <div className={styles.spinner} />
                    <p className={styles.stateText}>Loading activity…</p>
                </div>
            )}

            {showError && (
                <div className={styles.stateBox}>
                    <p className={styles.stateText}>{error}</p>
                </div>
            )}

            {!showError && !isLoading && entries.length === 0 && (
                <div className={styles.stateBox}>
                    <p className={styles.stateText}>No activity yet.</p>
                </div>
            )}

            {entries.map(entry =>
                entry.kind === "withdrawal" ? (
                    <ActivityRow key={entry.key} item={entry.item} />
                ) : (
                    <TransferRow key={entry.key} transfer={entry.transfer} />
                )
            )}
        </div>
        </>
    );
};

export default ActivityPanel;
