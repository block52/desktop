import React from "react";
import styles from "./TableDialog.module.css";

interface CloseTableModalProps {
    /** "delete" removes an empty table; "force-close" kicks everyone off and refunds them first. */
    mode: "delete" | "force-close";
    tableName: string;
    seatedPlayers: number;
    isSubmitting: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

export const CloseTableModal: React.FC<CloseTableModalProps> = ({ mode, tableName, seatedPlayers, isSubmitting, onConfirm, onClose }) => {
    const isForceClose = mode === "force-close";
    const playerWord = seatedPlayers === 1 ? "player" : "players";

    return (
        <div className={styles.overlay} onClick={isSubmitting ? undefined : onClose} role="presentation">
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-label={isForceClose ? "Close table" : "Delete table"}
                onClick={e => e.stopPropagation()}
            >
                <h2 className={styles.title}>{isForceClose ? "Close this table?" : "Delete this table?"}</h2>
                <p className={styles.body}>
                    {isForceClose
                        ? `All ${seatedPlayers} ${playerWord} will be removed from ${tableName} and their stacks refunded to their wallets.`
                        : `${tableName} is empty. It will be removed from the chain.`}
                </p>
                <p className={styles.warning}>
                    {isForceClose
                        ? "The hand in progress is cancelled (bets are returned to whoever posted them) and the table is permanently removed. This cannot be undone."
                        : "This cannot be undone."}
                </p>
                <div className={styles.actions}>
                    <button type="button" className={`btn-ghost ${styles.action}`} onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </button>
                    <button type="button" className={`${styles.action} ${styles.danger}`} onClick={onConfirm} disabled={isSubmitting}>
                        {isSubmitting ? "Working…" : isForceClose ? "Close table" : "Delete table"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CloseTableModal;
