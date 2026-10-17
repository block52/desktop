import React from "react";
import { MotionConfig, motion } from "motion/react";
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
        <MotionConfig reducedMotion="user">
            <ol className={styles.steps} aria-label="Withdrawal progress">
                {STEPS.map((step, index) => {
                    const state = index < active ? "done" : index === active ? "active" : "todo";
                    const busy = state === "active" && !waitingOnUser;
                    return (
                        <li key={step.title} className={`${styles.step} ${styles[state]}`} aria-current={state === "active" ? "step" : undefined}>
                            {index < STEPS.length - 1 && (
                                <span className={styles.track} aria-hidden="true">
                                    <motion.span className={styles.fill} initial={false} animate={{ scaleY: index < active ? 1 : 0 }} transition={{ duration: 0.5, ease: "easeInOut" }} />
                                </span>
                            )}
                            <motion.span
                                key={`${state}-${busy}`}
                                className={styles.marker}
                                aria-hidden="true"
                                initial={{ scale: 0.7 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 420, damping: 18 }}
                            >
                                {state === "done" && (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <motion.path d="M5 12.5 10 17.5 19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.1 }} />
                                    </svg>
                                )}
                                {busy && <span className={styles.spin} />}
                                {state === "todo" || (state === "active" && waitingOnUser) ? index + 1 : null}
                            </motion.span>
                            <span className={styles.text}>
                                <span className={styles.title}>{step.title}</span>
                                <span className={styles.detail}>{step.detail}</span>
                            </span>
                        </li>
                    );
                })}
            </ol>
        </MotionConfig>
    );
};

export default WithdrawSteps;
