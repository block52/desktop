import React, { useMemo, useState } from "react";
import { microToDecimal, parseUsdcToMicro } from "../../utils/currency";
import styles from "./JoinTableModal.module.css";

export interface JoinTableModalProps {
    seatNumber: number;
    /** Buy-in bounds and wallet balance, all in micro-USDC strings. */
    minBuyIn: string;
    maxBuyIn: string;
    balance: string;
    isSubmitting: boolean;
    /** Decimal USDC text, exactly as typed — the join action parses it. */
    onConfirm: (amount: string) => void;
    onClose: () => void;
}

function formatUsd(micro: bigint): string {
    return `$${(Number(micro) / 1_000_000).toFixed(2)}`;
}

export const JoinTableModal: React.FC<JoinTableModalProps> = ({ seatNumber, minBuyIn, maxBuyIn, balance, isSubmitting, onConfirm, onClose }) => {
    const min = BigInt(minBuyIn);
    const max = BigInt(maxBuyIn);
    const available = BigInt(balance);
    // The most this player can actually sit down with.
    const ceiling = available < max ? available : max;
    const isFixed = min === max;

    const [amount, setAmount] = useState<string>(microToDecimal(min));

    const amountMicro = useMemo(() => {
        try {
            return parseUsdcToMicro(amount);
        } catch {
            return null;
        }
    }, [amount]);

    const problem = useMemo(() => {
        if (available < min) {
            return `Your balance (${formatUsd(available)}) is below this table's minimum buy-in of ${formatUsd(min)}. Fund your wallet first.`;
        }
        if (amountMicro === null) {
            return "Enter a valid amount.";
        }
        if (amountMicro < min) {
            return `Minimum buy-in is ${formatUsd(min)}.`;
        }
        if (amountMicro > max) {
            return `Maximum buy-in is ${formatUsd(max)}.`;
        }
        if (amountMicro > available) {
            return `Amount exceeds your balance of ${formatUsd(available)}.`;
        }
        return null;
    }, [amountMicro, available, min, max]);

    const canConfirm = problem === null && !isSubmitting;
    const sliderMin = Number(min) / 1_000_000;
    // Never invert the range: with a balance under the minimum the slider just pins to min.
    const sliderMax = Math.max(Number(ceiling), Number(min)) / 1_000_000;
    const sliderEnabled = ceiling > min && !isSubmitting;
    const sliderNote = isFixed
        ? "This table has a fixed buy-in."
        : ceiling <= min
          ? "Your balance only covers the minimum buy-in."
          : null;
    const sliderValue = Math.min(Math.max(amountMicro !== null ? Number(amountMicro) / 1_000_000 : sliderMin, sliderMin), sliderMax);
    const fillPercent = sliderMax > sliderMin ? ((sliderValue - sliderMin) / (sliderMax - sliderMin)) * 100 : 0;

    return (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className={`pane ${styles.modal}`} role="dialog" aria-label={`Take seat ${seatNumber}`}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Take seat {seatNumber}</h2>
                    <button type="button" className={`btn-ghost ${styles.close}`} onClick={onClose} aria-label="Close">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.facts}>
                    <div className={styles.fact}>
                        <span className="section-label">Buy-in range</span>
                        <span className={styles.factValue}>
                            {isFixed ? formatUsd(min) : `${formatUsd(min)} – ${formatUsd(max)}`}
                        </span>
                    </div>
                    <div className={styles.fact}>
                        <span className="section-label">Your balance</span>
                        <span className={styles.factValue}>{formatUsd(available)}</span>
                    </div>
                </div>

                <div className={styles.sliderBlock}>
                    <input
                        type="range"
                        className={styles.slider}
                        style={{ "--fill": `${fillPercent}%` } as React.CSSProperties}
                        min={sliderMin}
                        max={sliderMax}
                        step="0.01"
                        value={sliderValue}
                        disabled={!sliderEnabled}
                        onChange={e => setAmount(Number(e.target.value).toFixed(2))}
                        aria-label="Buy-in slider"
                    />
                    <div className={styles.sliderEnds}>
                        <button type="button" className={styles.end} disabled={!sliderEnabled} onClick={() => setAmount(microToDecimal(min))}>
                            <span className="section-label">Min</span>
                            <span className={styles.endValue}>{formatUsd(min)}</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.end} ${styles.endRight}`}
                            disabled={!sliderEnabled}
                            onClick={() => setAmount(microToDecimal(ceiling))}
                        >
                            <span className="section-label">{ceiling > min && ceiling < max ? "Max (your balance)" : "Max"}</span>
                            <span className={styles.endValue}>{formatUsd(ceiling >= min ? ceiling : max)}</span>
                        </button>
                    </div>
                    {sliderNote !== null && <span className={styles.note}>{sliderNote}</span>}
                </div>

                <span className="section-label">Buy-in amount</span>
                <label className={styles.amountBox}>
                    <span className={styles.prefix}>$</span>
                    <input
                        className={styles.amountInput}
                        type="number"
                        inputMode="decimal"
                        min={Number(min) / 1_000_000}
                        max={Number(ceiling) / 1_000_000}
                        step="0.01"
                        value={amount}
                        readOnly={isFixed}
                        autoFocus
                        onChange={e => setAmount(e.target.value)}
                        aria-label="Buy-in amount"
                    />
                </label>

                {problem !== null && <p className={styles.problem}>{problem}</p>}

                <div className={styles.actions}>
                    <button type="button" className={`btn-ghost ${styles.cancel}`} onClick={onClose}>
                        Cancel
                    </button>
                    <button type="button" className={`btn-glow ${styles.confirm}`} disabled={!canConfirm} onClick={() => onConfirm(amount)}>
                        {isSubmitting ? "Joining…" : amountMicro !== null ? `Sit down · ${formatUsd(amountMicro)}` : "Sit down"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JoinTableModal;
