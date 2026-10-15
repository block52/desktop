import React from "react";
import type { WithdrawalActivityItem } from "../../hooks/useWithdrawalActivity";
import CompleteWithdrawalButton from "./CompleteWithdrawalButton";
import styles from "./PendingWithdrawals.module.css";

interface PendingWithdrawalsProps {
    items: WithdrawalActivityItem[];
    onCompleted: () => void;
}

/** Withdrawals that still have to be completed on Ethereum, kept apart from the history so they are not missed. */
const PendingWithdrawals: React.FC<PendingWithdrawalsProps> = ({ items, onCompleted }) => {
    if (items.length === 0) return null;

    return (
        <section className={`pane-lite ${styles.panel}`} aria-label="Withdrawals to complete">
            <div className={styles.head}>
                <span className="section-label">Withdrawals to complete</span>
                <span className={styles.count}>{items.length}</span>
            </div>
            <p className={styles.intro}>
                These were requested on Block52. Confirm each one in your Web3 wallet to receive the USDC on Ethereum.
            </p>
            {items.map(item => (
                <div key={item.nonce} className={styles.card}>
                    <div className={styles.info}>
                        <span className={styles.amount}>${(Number(item.amountMicro) / 1_000_000).toFixed(2)}</span>
                        <span className={styles.meta}>
                            To {item.toAddress.slice(0, 6)}…{item.toAddress.slice(-4)}
                            {item.createdAt !== null && ` · ${new Date(item.createdAt * 1000).toLocaleString()}`}
                        </span>
                    </div>
                    <CompleteWithdrawalButton item={item} signature={item.signature} onCompleted={onCompleted} />
                </div>
            ))}
        </section>
    );
};

export default PendingWithdrawals;
