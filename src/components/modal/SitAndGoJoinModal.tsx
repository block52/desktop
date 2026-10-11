import React from "react";
import { microToDecimal } from "../../utils/currency";
import styles from "./JoinTableModal.module.css";

export interface SitAndGoJoinModalProps {
    seatNumber: number;
    /** Fixed tournament buy-in, micro-USDC. */
    buyIn: string;
    /** Flat creator entry fee, micro-USDC — omitted/zero when the table has none. */
    entryFee?: string;
    /** Tournament chips each player starts with (displayed as-is, like blinds/pot on SNG tables). */
    startingStack?: string;
    /** Minutes per blind level. */
    blindLevelMinutes?: number;
    smallBlind: string;
    bigBlind: string;
    seated: number;
    maxPlayers: number;
    /** Wallet balance, micro-USDC. */
    balance: string;
    isSubmitting: boolean;
    /** Decimal USDC text of the buy-in, ready for the join action. */
    onConfirm: (amount: string) => void;
    onClose: () => void;
}

function formatUsd(micro: bigint): string {
    return `$${(Number(micro) / 1_000_000).toFixed(2)}`;
}

export const SitAndGoJoinModal: React.FC<SitAndGoJoinModalProps> = ({
    seatNumber,
    buyIn,
    entryFee,
    startingStack,
    blindLevelMinutes,
    smallBlind,
    bigBlind,
    seated,
    maxPlayers,
    balance,
    isSubmitting,
    onConfirm,
    onClose,
}) => {
    const buyInMicro = BigInt(buyIn);
    const balanceMicro = BigInt(balance);
    const feeMicro = entryFee !== undefined ? BigInt(entryFee) : 0n;
    const canAfford = balanceMicro >= buyInMicro;
    const spotsLeft = maxPlayers - seated;
    const fillPercent = maxPlayers > 0 ? (seated / maxPlayers) * 100 : 0;

    return (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className={`pane ${styles.modal}`} role="dialog" aria-label="Register for Sit & Go">
                <div className={styles.header}>
                    <h2 className={styles.title}>Register · Sit &amp; Go</h2>
                    <button type="button" className={`btn-ghost ${styles.close}`} onClick={onClose} aria-label="Close">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.fillBlock}>
                    <div className={styles.fillHead}>
                        <span className="section-label">Players</span>
                        <span className={styles.factValue}>
                            {seated} / {maxPlayers}
                        </span>
                    </div>
                    <div className={styles.fillTrack}>
                        <div className={styles.fillBar} style={{ width: `${fillPercent}%` }} />
                    </div>
                    <span className={styles.note}>
                        {spotsLeft > 1 ? `Starts automatically when all ${maxPlayers} seats are filled.` : "You'd be the last player — it starts as soon as you register."}
                    </span>
                </div>

                <div className={styles.rows}>
                    <div className={styles.row}>
                        <span>Seat</span>
                        <span className={styles.rowValue}>{seatNumber}</span>
                    </div>
                    <div className={styles.row}>
                        <span>Buy-in</span>
                        <span className={styles.rowValue}>{formatUsd(buyInMicro)}</span>
                    </div>
                    {feeMicro > 0n && (
                        <div className={styles.row}>
                            <span>Entry fee</span>
                            <span className={styles.rowValue}>{formatUsd(feeMicro)}</span>
                        </div>
                    )}
                    {startingStack !== undefined && (
                        <div className={styles.row}>
                            <span>Starting stack</span>
                            <span className={styles.rowValue}>{Number(startingStack).toLocaleString()} chips</span>
                        </div>
                    )}
                    <div className={styles.row}>
                        <span>Blinds</span>
                        <span className={styles.rowValue}>
                            {smallBlind} / {bigBlind}
                            {blindLevelMinutes !== undefined && blindLevelMinutes > 0 ? ` · +level every ${blindLevelMinutes} min` : ""}
                        </span>
                    </div>
                    <div className={styles.row}>
                        <span>Your balance</span>
                        <span className={styles.rowValue}>{formatUsd(balanceMicro)}</span>
                    </div>
                </div>

                {!canAfford && (
                    <p className={styles.problem}>
                        Your balance ({formatUsd(balanceMicro)}) is below the {formatUsd(buyInMicro)} buy-in. Fund your wallet first.
                    </p>
                )}

                <div className={styles.actions}>
                    <button type="button" className={`btn-ghost ${styles.cancel}`} onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={`btn-glow ${styles.confirm}`}
                        disabled={!canAfford || isSubmitting}
                        onClick={() => onConfirm(microToDecimal(buyInMicro))}
                    >
                        {isSubmitting ? "Registering…" : `Register · ${formatUsd(buyInMicro)}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SitAndGoJoinModal;
