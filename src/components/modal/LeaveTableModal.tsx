import React from "react";
import styles from "./TableDialog.module.css";

interface LeaveTableModalProps {
    /** What leaving returns, already formatted for display (e.g. "$12.50"). */
    returnAmount: string;
    /** Sit & Go before the start: leaving un-joins and refunds the buy-in rather than cashing out a stack. */
    isTournament: boolean;
    /** The player is in a live hand: leaving folds it and forfeits chips already in the pot. */
    isInActiveHand: boolean;
    isSubmitting: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

export const LeaveTableModal: React.FC<LeaveTableModalProps> = ({
    returnAmount,
    isTournament,
    isInActiveHand,
    isSubmitting,
    onConfirm,
    onClose
}) => (
    <div className={styles.overlay} onClick={isSubmitting ? undefined : onClose} role="presentation">
        <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Leave table" onClick={e => e.stopPropagation()}>
            <h2 className={styles.title}>{isTournament ? "Leave the tournament?" : "Leave table?"}</h2>
            <p className={styles.body}>
                {isTournament
                    ? "The tournament has not started, so leaving gives your buy-in back and frees your seat."
                    : "Your stack goes back to your wallet and your seat is freed."}
            </p>
            {isInActiveHand && (
                <p className={styles.warning}>
                    You are in a hand right now. Leaving folds it and forfeits any chips you have already put in the pot.
                </p>
            )}
            <div className={styles.summary}>
                <span className={styles.summaryLabel}>{isTournament ? "Buy-in refunded" : "You receive"}</span>
                <span className={styles.summaryValue}>{returnAmount}</span>
            </div>
            <div className={styles.actions}>
                <button type="button" className={`btn-ghost ${styles.action}`} onClick={onClose} disabled={isSubmitting}>
                    Stay
                </button>
                <button type="button" className={`${styles.action} ${styles.danger}`} onClick={onConfirm} disabled={isSubmitting}>
                    {isSubmitting ? "Leaving…" : "Leave table"}
                </button>
            </div>
        </div>
    </div>
);

export default LeaveTableModal;
