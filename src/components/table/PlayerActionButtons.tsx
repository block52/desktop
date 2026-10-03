import React from "react";
import { PlayerActionType, hasAction } from "@block52/poker-vm-sdk";
import type { LegalActionDTO } from "@block52/poker-vm-sdk";
import styles from "./PlayerActionButtons.module.css";

export interface PlayerActionButtonsProps {
    isSubmitting: boolean;
    legalActions: LegalActionDTO[];
    isPlayerTurn: boolean;
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
    legalActions,
    isPlayerTurn,
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
            <button
                className={styles.btn}
                disabled={isSubmitting || !isPlayerTurn || !hasAction(legalActions, PlayerActionType.BET)}
                onClick={onBet}
            >
                Bet
            </button>
            <input
                className={styles.input}
                placeholder="Call"
                value={callAmount}
                onChange={e => onCallAmountChange(e.target.value)}
            />
            <button
                className={styles.btn}
                disabled={isSubmitting || !isPlayerTurn || !hasAction(legalActions, PlayerActionType.CALL)}
                onClick={onCall}
            >
                Call
            </button>
            <input
                className={styles.input}
                placeholder="Raise"
                value={raiseAmount}
                onChange={e => onRaiseAmountChange(e.target.value)}
            />
            <button
                className={styles.btn}
                disabled={isSubmitting || !isPlayerTurn || !hasAction(legalActions, PlayerActionType.RAISE)}
                onClick={onRaise}
            >
                Raise
            </button>
            <button
                className={styles.btn}
                disabled={isSubmitting || !isPlayerTurn || !hasAction(legalActions, PlayerActionType.CHECK)}
                onClick={onCheck}
            >
                Check
            </button>
            <button
                className={`${styles.btn} ${styles.danger}`}
                disabled={isSubmitting || !isPlayerTurn || !hasAction(legalActions, PlayerActionType.FOLD)}
                onClick={onFold}
            >
                Fold
            </button>
            <button
                className={styles.btn}
                disabled={isSubmitting || !isPlayerTurn || !hasAction(legalActions, PlayerActionType.MUCK)}
                onClick={onMuck}
            >
                Muck
            </button>
            <button
                className={styles.btn}
                disabled={isSubmitting || !isPlayerTurn || !hasAction(legalActions, PlayerActionType.SHOW)}
                onClick={onShow}
            >
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
