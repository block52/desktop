import React, { useState } from "react";
import styles from "./TableDialog.module.css";

const ORDINALS = ["1st", "2nd", "3rd"];
const ordinal = (place: number): string => ORDINALS[place - 1] ?? `${place}th`;

interface SitAndGoResultModalProps {
    place: number;
    /** Payout as a display string ("$2.52"), or undefined when the finish is unpaid. */
    payout: string | undefined;
    /** Settle the prize on-chain (record the finished hand, then MsgLeaveGame). */
    onClaim: () => Promise<void>;
    /** Leave the finished table (unpaid finishers; frees the table to be reaped). */
    onLeave: () => Promise<void>;
    onClose: () => void;
}

type Status = { kind: "idle" } | { kind: "working" } | { kind: "done" } | { kind: "error"; message: string };

/** Shown once a player has a final placement in a Sit & Go: the place, the prize, and the way to collect it. */
export const SitAndGoResultModal: React.FC<SitAndGoResultModalProps> = ({ place, payout, onClaim, onLeave, onClose }) => {
    const [status, setStatus] = useState<Status>({ kind: "idle" });
    const isPaid = payout !== undefined;
    const isWinner = place === 1;

    const run = async (action: () => Promise<void>) => {
        setStatus({ kind: "working" });
        try {
            await action();
            setStatus({ kind: "done" });
        } catch (err) {
            setStatus({ kind: "error", message: err instanceof Error ? err.message : String(err) });
        }
    };

    const heading = isWinner ? "You won the tournament!" : isPaid ? `You finished ${ordinal(place)}!` : `Busted out — ${ordinal(place)} place`;

    return (
        <div className={styles.overlay} role="presentation">
            <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Tournament result">
                <h2 className={styles.title}>{heading}</h2>
                {isPaid ? (
                    <div className={`${styles.summary} ${styles.payout}`}>
                        <span className={styles.summaryLabel}>Your payout</span>
                        <span className={styles.summaryValue}>{payout}</span>
                    </div>
                ) : (
                    <p className={styles.body}>Thanks for playing. Better luck in the next one.</p>
                )}
                {status.kind === "error" && <p className={styles.error}>{status.message}</p>}
                <div className={styles.actions}>
                    {status.kind === "done" ? (
                        <button type="button" className={`btn-glow ${styles.action}`} onClick={onClose}>
                            {isPaid ? "Paid — close" : "Close"}
                        </button>
                    ) : (
                        <>
                            <button type="button" className={`btn-ghost ${styles.action}`} onClick={onClose} disabled={status.kind === "working"}>
                                Spectate
                            </button>
                            <button
                                type="button"
                                className={`btn-glow ${styles.action}`}
                                disabled={status.kind === "working"}
                                onClick={() => void run(isPaid ? onClaim : onLeave)}
                            >
                                {status.kind === "working" ? (isPaid ? "Collecting…" : "Leaving…") : isPaid ? `Collect ${payout}` : "Leave table"}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SitAndGoResultModal;
