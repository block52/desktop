import React from "react";
import { NonPlayerActionType, PlayerActionType, hasAction } from "@block52/poker-vm-sdk";
import type { LegalActionDTO } from "@block52/poker-vm-sdk";
import styles from "./PlayerActionButtons.module.css";

export interface PlayerActionButtonsProps {
    isSubmitting: boolean;
    legalActions: LegalActionDTO[];
    isPlayerTurn: boolean;
    /** Wager amount in display units (USDC for cash, chips for tournaments). */
    wagerAmount: string;
    onWagerChange: (value: string) => void;
    /** Pot in the same display units, for the ½/¾/Pot presets. */
    potValue: number;
    /** Raw units per displayed unit: 1_000_000 for cash (micro-USDC), 1 for tournament chips. */
    microPerUnit?: number;
    /** Prefix for amounts: "$" for cash, "" for tournament chips. */
    currencySymbol?: string;
    onBet: () => void;
    onCall: () => void;
    onRaise: () => void;
    onCheck: () => void;
    onFold: () => void;
    onMuck: () => void;
    onShow: () => void;
    onSitIn: () => void;
    onSitInAndWait: () => void;
}

/** Micro → display units with two decimals (matches the mock's $0.08 style). */
export function formatAmount(micro: string, microPerUnit = 1_000_000): string {
    return (Number(micro) / microPerUnit).toFixed(microPerUnit === 1 ? 0 : 2);
}

export function actionMin(legalActions: LegalActionDTO[], action: PlayerActionType): string | null {
    const match = legalActions.find(a => a.action === action);
    return match?.min ?? null;
}

export function primaryAction(legalActions: LegalActionDTO[]): { type: "bet" | "raise"; min: string; max: string } | null {
    const bet = legalActions.find(a => a.action === PlayerActionType.BET && a.min !== undefined && a.max !== undefined);
    if (bet !== undefined && bet.min !== undefined && bet.max !== undefined) {
        return { type: "bet", min: bet.min, max: bet.max };
    }
    const raise = legalActions.find(a => a.action === PlayerActionType.RAISE && a.min !== undefined && a.max !== undefined);
    if (raise !== undefined && raise.min !== undefined && raise.max !== undefined) {
        return { type: "raise", min: raise.min, max: raise.max };
    }
    return null;
}

/** Preset wager for a pot fraction, clamped to the action's min/max. */
export function presetForPot(fraction: number, potValue: number, min: number, max: number, decimals = 2): string {
    const raw = potValue * fraction;
    const clamped = Math.min(Math.max(raw, min), max);
    return clamped.toFixed(decimals);
}

const PRESETS: Array<{ label: string; fraction: number }> = [
    { label: "½ pot", fraction: 0.5 },
    { label: "¾ pot", fraction: 0.75 },
    { label: "Pot", fraction: 1 }
];

export const PlayerActionButtons: React.FC<PlayerActionButtonsProps> = ({
    isSubmitting,
    legalActions,
    isPlayerTurn,
    wagerAmount,
    onWagerChange,
    potValue,
    microPerUnit = 1_000_000,
    currencySymbol = "$",
    onBet,
    onCall,
    onRaise,
    onCheck,
    onFold,
    onMuck,
    onShow,
    onSitIn,
    onSitInAndWait
}) => {
    const primary = primaryAction(legalActions);
    const callMin = actionMin(legalActions, PlayerActionType.CALL);
    const canCheck = hasAction(legalActions, PlayerActionType.CHECK);
    const canMuck = hasAction(legalActions, PlayerActionType.MUCK);
    const canShow = hasAction(legalActions, PlayerActionType.SHOW);
    const canSitIn = hasAction(legalActions, NonPlayerActionType.SIT_IN);
    const canSitInAndWait = hasAction(legalActions, NonPlayerActionType.SIT_IN_AND_WAIT);
    const turnLocked = isSubmitting || !isPlayerTurn;

    const primaryMin = primary !== null ? Number(primary.min) / microPerUnit : 0;
    const primaryMax = primary !== null ? Number(primary.max) / microPerUnit : 0;
    const wager = parseFloat(wagerAmount) || 0;
    const decimals = microPerUnit === 1 ? 0 : 2;

    const primaryLabel =
        primary === null
            ? "Bet"
            : `${primary.type === "bet" ? "Bet" : "Raise to"} ${currencySymbol}${wager > 0 ? wager.toFixed(decimals) : primaryMin.toFixed(decimals)}`;

    return (
        <div className={`pane ${styles.bar}`}>
            <div className={styles.turn}>
                <span className={`section-label ${isPlayerTurn ? styles.turnOn : ""}`}>{isPlayerTurn ? "Your turn" : "Not your turn"}</span>
                {(canSitIn || canSitInAndWait) && (
                    <div className={styles.sitRow}>
                        {canSitIn && (
                            <button className={styles.sitButton} disabled={isSubmitting} onClick={onSitIn}>
                                Sit in
                            </button>
                        )}
                        {canSitInAndWait && (
                            <button className={styles.sitButton} disabled={isSubmitting} onClick={onSitInAndWait}>
                                Sit in and wait
                            </button>
                        )}
                    </div>
                )}
            </div>

            {primary !== null && (
                <div className={styles.wager}>
                    {PRESETS.map(({ label, fraction }) => {
                        const value = presetForPot(fraction, potValue, primaryMin, primaryMax, decimals);
                        const selected = wager > 0 && value === wager.toFixed(2);
                        return (
                            <button
                                key={label}
                                className={`${styles.preset} ${selected ? styles.presetOn : ""}`}
                                disabled={turnLocked}
                                onClick={() => onWagerChange(value)}
                            >
                                {label}
                            </button>
                        );
                    })}
                    <input
                        type="range"
                        className={styles.slider}
                        min={primaryMin}
                        max={primaryMax}
                        step={primaryMin > 0 ? primaryMin : 0.01}
                        value={Math.min(Math.max(wager, primaryMin), primaryMax)}
                        disabled={turnLocked}
                        onChange={e => onWagerChange(e.target.value)}
                        aria-label="Wager amount"
                    />
                    <label className={styles.amountBox}>
                        <span className={styles.amountPrefix}>{currencySymbol}</span>
                        <input
                            type="number"
                            className={styles.amountInput}
                            value={wagerAmount}
                            min={primaryMin}
                            max={primaryMax}
                            step="0.01"
                            disabled={turnLocked}
                            onChange={e => onWagerChange(e.target.value)}
                            aria-label="Wager value"
                        />
                    </label>
                </div>
            )}

            <div className={styles.actions}>
                <button className={`btn-ghost ${styles.btn}`} disabled={turnLocked} onClick={onFold}>
                    Fold
                </button>
                {canCheck && (
                    <button className={`btn-ghost ${styles.btn}`} disabled={turnLocked} onClick={onCheck}>
                        Check
                    </button>
                )}
                {callMin !== null && (
                    <button className={`btn-ghost ${styles.btn}`} disabled={turnLocked} onClick={onCall}>
                        Call {currencySymbol}{formatAmount(callMin, microPerUnit)}
                    </button>
                )}
                {canMuck && (
                    <button className={`btn-ghost ${styles.btn}`} disabled={turnLocked} onClick={onMuck}>
                        Muck
                    </button>
                )}
                {canShow && (
                    <button className={`btn-ghost ${styles.btn}`} disabled={turnLocked} onClick={onShow}>
                        Show
                    </button>
                )}
                <button
                    className={`btn-glow shimmer-hover ${styles.primaryBtn}`}
                    disabled={turnLocked || primary === null}
                    onClick={primary?.type === "raise" ? onRaise : onBet}
                >
                    {primaryLabel}
                </button>
            </div>
        </div>
    );
};

export default PlayerActionButtons;
