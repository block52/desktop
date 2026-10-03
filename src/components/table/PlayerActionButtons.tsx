import React from "react";
import styles from "./PlayerActionButtons.module.css";

export interface PlayerActionButtonsProps {
    isSubmitting: boolean;
    betAmount: string;
    onBetAmountChange: (value: string) => void;
    callAmount: string;
    onCallAmountChange: (value: string) => void;
    raiseAmount: string;
    onRaiseAmountChange: (value: string) => void;
    onBet: () => void;
    onCall: () => void;
    onRaise: () => void;
    onCheck: () => void;
    onFold: () => void;
    onMuck: () => void;
    onShow: () => void;
    onSitIn: () => void;
    onSitInAndWait: () => void;
    onSitOut: () => void;
    autoStatusNote: string;
}

export const PlayerActionButtons: React.FC<PlayerActionButtonsProps> = ({
    isSubmitting,
    betAmount,
    onBetAmountChange,
    callAmount,
    onCallAmountChange,
    raiseAmount,
    onRaiseAmountChange,
    onBet,
    onCall,
    onRaise,
    onCheck,
    onFold,
    onMuck,
    onShow,
    onSitIn,
    onSitInAndWait,
    onSitOut,
    autoStatusNote,
}) => {
    return (
        <div className={styles.bar}>
            <input
                className={styles.input}
                placeholder="Bet"
                value={betAmount}
                onChange={e => onBetAmountChange(e.target.value)}
            />
            <button className={styles.btn} disabled={isSubmitting} onClick={onBet}>
                Bet
            </button>
            <input
                className={styles.input}
                placeholder="Call"
                value={callAmount}
                onChange={e => onCallAmountChange(e.target.value)}
            />
            <button className={styles.btn} disabled={isSubmitting} onClick={onCall}>
                Call
            </button>
            <input
                className={styles.input}
                placeholder="Raise"
                value={raiseAmount}
                onChange={e => onRaiseAmountChange(e.target.value)}
            />
            <button className={styles.btn} disabled={isSubmitting} onClick={onRaise}>
                Raise
            </button>
            <button className={styles.btn} disabled={isSubmitting} onClick={onCheck}>
                Check
            </button>
            <button className={`${styles.btn} ${styles.danger}`} disabled={isSubmitting} onClick={onFold}>
                Fold
            </button>
            <button className={styles.btn} disabled={isSubmitting} onClick={onMuck}>
                Muck
            </button>
            <button className={styles.btn} disabled={isSubmitting} onClick={onShow}>
                Show
            </button>
            <button className={styles.btn} disabled={isSubmitting} onClick={onSitIn}>
                Sit In
            </button>
            <button className={styles.btn} disabled={isSubmitting} onClick={onSitInAndWait}>
                Sit In And Wait
            </button>
            <button className={styles.btn} disabled={isSubmitting} onClick={onSitOut}>
                Sit Out
            </button>
            {autoStatusNote && <div className={styles.autoNote}>{autoStatusNote}</div>}
        </div>
    );
};

export default PlayerActionButtons;
