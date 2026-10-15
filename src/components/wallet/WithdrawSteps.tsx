import React from "react";
import styles from "./WithdrawSteps.module.css";

export type WithdrawStage = "initiating" | "waiting_sig" | "ready" | "completing";

interface WithdrawStepsProps {
    stage: WithdrawStage;
}

const STEPS = [
    { title: "Submit request", detail: "Signed with your wallet on Block52" },
    { title: "Validator signature", detail: "Validators approve the withdrawal" },
    { title: "Complete on Ethereum", detail: "Confirm in your Web3 wallet" }
];

const ACTIVE_INDEX: Record<WithdrawStage, number> = { initiating: 0, waiting_sig: 1, ready: 2, completing: 2 };

/** A busy step spins; a step the user has to act on shows its number; finished steps get a tick. */
const WithdrawSteps: React.FC<WithdrawStepsProps> = ({ stage }) => {
    const active = ACTIVE_INDEX[stage];
    const waitingOnUser = stage === "ready";

    return (
        <ol className={styles.steps} aria-label="Withdrawal progress">
            {STEPS.map((step, index) => {
                const state = index < active ? "done" : index === active ? "active" : "todo";
                const busy = state === "active" && !waitingOnUser;
                return (
                    <li key={step.title} className={`${styles.step} ${styles[state]}`} aria-current={state === "active" ? "step" : undefined}>
                        <span className={styles.marker} aria-hidden="true">
                            {state === "done" && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M5 12.5 10 17.5 19 7" />
                                </svg>
                            )}
                            {busy && <span className={styles.spin} />}
                            {state === "todo" || (state === "active" && waitingOnUser) ? index + 1 : null}
                        </span>
                        <span className={styles.text}>
                            <span className={styles.title}>{step.title}</span>
                            <span className={styles.detail}>{step.detail}</span>
                        </span>
                    </li>
                );
            })}
        </ol>
    );
};

export default WithdrawSteps;
