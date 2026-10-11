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
    /** Label of the action currently being sent ("Call", "Bet", ...); that button shows a spinner. */
    pendingAction?: string | null;
    /** Plain-language strength of the player's hand ("Pair of Aces"); null when unknown or folded. */
    handLabel?: string | null;
    /** Cash games: opens the add-chips dialog. Omitted on tournaments and when not seated. */
    onTopUp?: () => void;
    /** Whether the chain currently allows a top-up (not while in the hand). */
    canTopUp?: boolean;
    /** Cash games: the "sit out next hand / next big blind" boxes. Omitted when sitting out isn't allowed. */
    sitOut?: {
        nextHandChecked: boolean;
        nextBbChecked: boolean;
        onToggleNextHand: () => void;
        onToggleNextBb: () => void;
    };
    /** Offer the pre-selected "Check" box (before your turn, check is free). */
    showPreCheck?: boolean;
    preCheckQueued?: boolean;
    onPreCheckChange?: (queued: boolean) => void;
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
    pendingAction = null,
    handLabel = null,
    onTopUp,
    canTopUp = false,
    sitOut,
    showPreCheck = false,
    preCheckQueued = false,
    onPreCheckChange,
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
                <div className={styles.statusRow}>
                    <span className={`${styles.statusChip} ${isPlayerTurn ? styles.statusOn : ""}`}>
                        <span className={styles.statusDot} />
                        {isPlayerTurn ? "Your turn" : "Not your turn"}
                    </span>
                    {handLabel !== null && <span className={styles.handLabel}>{handLabel}</span>}
                </div>
                {sitOut !== undefined && (
                    <div className={styles.sitOutBoxes}>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={sitOut.nextHandChecked}
                            className={`${styles.toggle} ${sitOut.nextHandChecked ? styles.toggleOn : ""}`}
                            onClick={sitOut.onToggleNextHand}
                        >
                            <span className={styles.toggleTrack} />
                            Sit out next hand
                        </button>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={sitOut.nextBbChecked}
                            className={`${styles.toggle} ${sitOut.nextBbChecked ? styles.toggleOn : ""}`}
                            onClick={sitOut.onToggleNextBb}
                        >
                            <span className={styles.toggleTrack} />
                            Sit out next big blind
                        </button>
                    </div>
                )}
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

            {showPreCheck && onPreCheckChange !== undefined && (
                <button
                    type="button"
                    role="checkbox"
                    aria-checked={preCheckQueued}
                    className={`btn-ghost ${styles.preCheck} ${preCheckQueued ? styles.preCheckOn : ""}`}
                    title="Checks for you when your turn comes if it is still free. If someone bets first this clears and it is your decision."
                    onClick={() => onPreCheckChange(!preCheckQueued)}
                >
                    <span className={styles.preCheckBox}>{preCheckQueued ? "✓" : ""}</span>
                    Check when it&apos;s my turn
                </button>
            )}

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
                {onTopUp !== undefined && (
                    <button
                        type="button"
                        className={`btn-ghost ${styles.addChips}`}
                        disabled={!canTopUp || isSubmitting}
                        onClick={onTopUp}
                        title={canTopUp ? "Add chips to your stack" : "You can add chips between hands, not while you are in the current hand."}
                    >
                        + Add chips
                    </button>
                )}
                <button className={`btn-ghost ${styles.btn}`} disabled={turnLocked} onClick={onFold}>
                    {pendingAction === "Fold" && <span className={styles.spinner} />}
                    Fold
                </button>
                {canCheck && (
                    <button className={`btn-ghost ${styles.btn}`} disabled={turnLocked} onClick={onCheck}>
                        {pendingAction === "Check" && <span className={styles.spinner} />}
                        Check
                    </button>
                )}
                {callMin !== null && (
                    <button className={`btn-ghost ${styles.btn}`} disabled={turnLocked} onClick={onCall}>
                        {pendingAction === "Call" && <span className={styles.spinner} />}
                        Call {currencySymbol}{formatAmount(callMin, microPerUnit)}
                    </button>
                )}
                {canMuck && (
                    <button className={`btn-ghost ${styles.btn}`} disabled={turnLocked} onClick={onMuck}>
                        {pendingAction === "Muck" && <span className={styles.spinner} />}
                        Muck
                    </button>
                )}
                {canShow && (
                    <button className={`btn-ghost ${styles.btn}`} disabled={turnLocked} onClick={onShow}>
                        {pendingAction === "Show" && <span className={styles.spinner} />}
                        Show
                    </button>
                )}
                <button
                    className={`btn-glow shimmer-hover ${styles.primaryBtn}`}
                    disabled={turnLocked || primary === null}
                    onClick={primary?.type === "raise" ? onRaise : onBet}
                >
                    {(pendingAction === "Bet" || pendingAction === "Raise") && <span className={styles.spinner} />}
                    {primaryLabel}
                </button>
            </div>
        </div>
    );
};

export default PlayerActionButtons;
