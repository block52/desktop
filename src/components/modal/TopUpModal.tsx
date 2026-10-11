import React, { useState } from "react";
import { microToDecimal, parseUsdcToMicro } from "../../utils/currency";
import styles from "./TableDialog.module.css";

interface TopUpModalProps {
    /** Chips currently on the seat, micro-USDC. */
    stack: bigint;
    /** The most this seat can add: min(max buy-in headroom, wallet balance), micro-USDC. */
    maxAddable: bigint;
    isSubmitting: boolean;
    onConfirm: (amountMicro: bigint) => void;
    onClose: () => void;
}

/** Add chips to your stack between hands; applied at the next hand. */
export const TopUpModal: React.FC<TopUpModalProps> = ({ stack, maxAddable, isSubmitting, onConfirm, onClose }) => {
    const [value, setValue] = useState("");

    let amount: bigint | null = null;
    let problem = "";
    if (value.trim() !== "") {
        try {
            amount = parseUsdcToMicro(value.trim());
            if (amount <= 0n) {
                problem = "Enter an amount above zero";
            } else if (amount > maxAddable) {
                problem = `You can add at most $${microToDecimal(maxAddable)}`;
            }
        } catch {
            problem = "Enter a dollar amount like 5 or 12.50";
        }
    }
    const canSubmit = amount !== null && problem === "" && !isSubmitting;

    return (
        <div className={styles.overlay} onClick={isSubmitting ? undefined : onClose} role="presentation">
            <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Add chips" onClick={e => e.stopPropagation()}>
                <h2 className={styles.title}>Add chips</h2>
                <p className={styles.body}>Chips are added to your stack and are in play from the next hand.</p>
                <div className={styles.summary}>
                    <span className={styles.summaryLabel}>Current stack</span>
                    <span className={styles.summaryValue}>${microToDecimal(stack)}</span>
                </div>
                <label className={styles.field}>
                    <span className={styles.fieldLabel}>Amount to add (max ${microToDecimal(maxAddable)})</span>
                    <input
                        className={styles.input}
                        inputMode="decimal"
                        autoFocus
                        placeholder="0.00"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === "Enter" && canSubmit && amount !== null) onConfirm(amount);
                        }}
                    />
                </label>
                <div className={styles.presets}>
                    {[0.25, 0.5, 1].map(fraction => {
                        const preset = (maxAddable * BigInt(Math.round(fraction * 100))) / 100n;
                        return (
                            <button
                                key={fraction}
                                type="button"
                                className={`btn-ghost ${styles.preset}`}
                                disabled={preset <= 0n}
                                onClick={() => setValue(microToDecimal(preset))}
                            >
                                {fraction === 1 ? "Max" : `${fraction * 100}%`}
                            </button>
                        );
                    })}
                </div>
                {problem !== "" && <p className={styles.error}>{problem}</p>}
                <div className={styles.actions}>
                    <button type="button" className={`btn-ghost ${styles.action}`} onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={`btn-glow ${styles.action}`}
                        disabled={!canSubmit}
                        onClick={() => amount !== null && onConfirm(amount)}
                    >
                        {isSubmitting ? "Adding…" : "Add chips"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TopUpModal;
