import React from "react";
import styles from "./StepButtons.module.css";

export type BlockingStep = "small-blind" | "big-blind" | "deal" | null;

export interface StepButtonsProps {
    showSmallBlind: boolean;
    showBigBlind: boolean;
    /** Amounts already formatted for display (no currency symbol). */
    smallAmount: string;
    bigAmount: string;
    currencySymbol: string;
    canDeal: boolean;
    handNumber: number;
    /** Which step is in flight (sent by hand or automatically): its button shows the working state. */
    blockingStep: BlockingStep;
    disabled: boolean;
    onPostSmall: () => void;
    onPostBig: () => void;
    onDeal: () => void;
}

/** The blind-posting and deal steps the game drives for you, shown under your seat like the web app. */
export const StepButtons: React.FC<StepButtonsProps> = ({
    showSmallBlind,
    showBigBlind,
    smallAmount,
    bigAmount,
    currencySymbol,
    canDeal,
    handNumber,
    blockingStep,
    disabled,
    onPostSmall,
    onPostBig,
    onDeal
}) => {
    const locked = disabled || blockingStep !== null;

    return (
        <div className={styles.steps}>
            {showSmallBlind && (
                <button type="button" className={styles.stepButton} disabled={locked} onClick={onPostSmall}>
                    {blockingStep === "small-blind" ? (
                        <>
                            <span className={styles.spinner} />
                            POSTING…
                        </>
                    ) : (
                        <>
                            Post small blind <b>{currencySymbol}{smallAmount}</b>
                        </>
                    )}
                </button>
            )}
            {showBigBlind && (
                <button type="button" className={styles.stepButton} disabled={locked} onClick={onPostBig}>
                    {blockingStep === "big-blind" ? (
                        <>
                            <span className={styles.spinner} />
                            POSTING…
                        </>
                    ) : (
                        <>
                            Post big blind <b>{currencySymbol}{bigAmount}</b>
                        </>
                    )}
                </button>
            )}
            {canDeal && (
                <button type="button" className={styles.stepButton} disabled={locked} onClick={onDeal}>
                    {blockingStep === "deal" ? (
                        <>
                            <span className={styles.spinner} />
                            DEALING HAND #{handNumber}…
                        </>
                    ) : (
                        <>DEAL</>
                    )}
                </button>
            )}
        </div>
    );
};

export default StepButtons;
