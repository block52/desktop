import React, { useEffect, useRef } from "react";
import type { ActionDTO } from "@block52/poker-vm-sdk";
import { shortAddress } from "./shortAddress";
import styles from "./HandLog.module.css";

export interface HandLogProps {
    actions: ActionDTO[];
    handNumber: number;
    /** Local player's address (lowercased) — their rows read "You". */
    localAddress: string | null;
    /** Same formatter the seats use for stacks/pot. */
    formatAmount: (micro: string) => string;
    onClose: () => void;
    onReplay: () => void;
}

export const ACTION_VERBS: Record<string, string> = {
    "post-small-blind": "posts small blind",
    "post-big-blind": "posts big blind",
    "dead-small-blind": "posts dead small blind",
    fold: "folds",
    check: "checks",
    bet: "bets",
    call: "calls",
    raise: "raises to",
    "all-in": "goes all in",
    muck: "mucks",
    show: "shows",
    deal: "deals",
    join: "joins",
    leave: "leaves",
    "new-hand": "starts a new hand",
    "sit-in": "sits in",
    "sit-out": "sits out",
    timeout: "timed out",
};

function describeAction(action: ActionDTO, formatAmount: (micro: string) => string): string {
    const verb = ACTION_VERBS[action.action] ?? action.action.replace(/-/g, " ");
    const hasAmount = action.amount !== "" && action.amount !== "0";
    return hasAmount ? `${verb} $${formatAmount(action.amount)}` : verb;
}

function roundLabel(round: string): string {
    return round.charAt(0).toUpperCase() + round.slice(1);
}

export const HandLog: React.FC<HandLogProps> = ({ actions, handNumber, localAddress, formatAmount, onClose, onReplay }) => {
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const list = listRef.current;
        if (list !== null) {
            list.scrollTop = list.scrollHeight;
        }
    }, [actions.length]);

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <aside className={`pane ${styles.panel}`} onClick={e => e.stopPropagation()} aria-label="Hand log">
                <div className={styles.head}>
                    <span className={styles.title}>Hand #{handNumber}</span>
                    <button type="button" className={styles.replay} onClick={onReplay}>
                        Replay
                    </button>
                </div>
                <div className={styles.list} ref={listRef}>
                    {actions.length === 0 ? (
                        <div className={styles.empty}>No actions yet this hand.</div>
                    ) : (
                        actions.map(action => (
                            <div key={action.index} className={styles.row}>
                                <span className={styles.round}>{roundLabel(action.round)}</span>
                                <span className={styles.what}>
                                    <b>{localAddress !== null && action.playerId.toLowerCase() === localAddress ? "You" : shortAddress(action.playerId)}</b>{" "}
                                    {describeAction(action, formatAmount)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </aside>
        </div>
    );
};

export default HandLog;
