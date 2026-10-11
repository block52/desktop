import React from "react";
import styles from "./SeatBanner.module.css";

export interface SeatBannerAction {
    /** Raw action name from the server, e.g. "post-small-blind". */
    action: string;
    /** Amount already formatted for display; omit for actions without one. */
    amount?: string;
    /** Action index — a new index means a new action to announce. */
    index: number;
}

export type SeatStatusLabel = "FOLD" | "ALL IN" | "SITTING OUT";

export interface SeatBannerProps {
    lastAction?: SeatBannerAction;
    /** This seat is to act: shows the turn countdown. */
    isActive?: boolean;
    /** Seconds the seat has to act. */
    turnTimeoutSec?: number;
    /** Seconds actually left on the clock now; the bar starts from this. Defaults to the full timeout. */
    turnRemainingSec?: number;
    /** Changes each turn so the bar restarts. */
    turnKey?: string;
    status?: SeatStatusLabel;
    /** The seat won the pot: shows the "WINS" banner with the hand's name. */
    winner?: { description?: string };
    /** Seat hangs its badge above the avatar (upper-half seats): the strip sits on top of the nameplate. */
    flipped?: boolean;
}

const ANNOUNCED_MS = 2500;

const ACTION_LABELS: Record<string, string> = {
    fold: "FOLD",
    check: "CHECK",
    call: "CALL",
    bet: "BET",
    raise: "RAISE",
    "all-in": "ALL IN",
    "post-small-blind": "POST SB",
    "post-big-blind": "POST BB",
    muck: "MUCK",
    show: "SHOW"
};

type Tone = "aggressive" | "passive" | "fold" | "blind" | "neutral";

const ACTION_TONES: Record<string, Tone> = {
    bet: "aggressive",
    raise: "aggressive",
    "all-in": "aggressive",
    call: "passive",
    check: "passive",
    fold: "fold",
    "post-small-blind": "blind",
    "post-big-blind": "blind"
};

/**
 * The strip under a seat's nameplate: the action just taken (for a few seconds), else the
 * turn countdown while the seat is to act, else the seat's standing status (fold / all in / sitting out).
 */
export const SeatBanner: React.FC<SeatBannerProps> = ({ lastAction, isActive, turnTimeoutSec, turnRemainingSec, turnKey, status, winner, flipped }) => {
    // The action already on the seat when it mounted is history, not news.
    const [initialIndex] = React.useState(lastAction?.index);
    const [expiredIndex, setExpiredIndex] = React.useState<number | undefined>(undefined);
    const announcedIndex = lastAction?.index;

    React.useEffect(() => {
        if (announcedIndex === undefined || announcedIndex === initialIndex) return;
        const timer = setTimeout(() => setExpiredIndex(announcedIndex), ANNOUNCED_MS);
        return () => clearTimeout(timer);
    }, [announcedIndex, initialIndex]);

    const flip = flipped === true ? ` ${styles.flipped}` : "";

    if (winner !== undefined) {
        return (
            <div className={`${styles.banner} ${styles.win}${flip}`} role="status">
                <span className={styles.winTitle}>WINS</span>
                {winner.description !== undefined && <span className={styles.winHandName}>{winner.description}</span>}
            </div>
        );
    }

    const label = lastAction !== undefined ? ACTION_LABELS[lastAction.action] : undefined;
    const isAnnounced =
        lastAction !== undefined && label !== undefined && lastAction.index !== initialIndex && lastAction.index !== expiredIndex;

    if (isAnnounced) {
        return (
            <div key={`a${lastAction.index}`} className={`${styles.banner} ${styles.announce} ${styles[ACTION_TONES[lastAction.action] ?? "neutral"]}${flip}`}>
                <span className={styles.label}>{label}</span>
                {lastAction.amount !== undefined && <span className={styles.amount}>{lastAction.amount}</span>}
            </div>
        );
    }

    if (isActive && turnTimeoutSec !== undefined && turnTimeoutSec > 0) {
        return (
            <div className={`${styles.banner} ${styles.timer}${flip}`} role="timer" aria-label="Time to act">
                <div className={styles.timerTrack}>
                    <div
                        key={turnKey}
                        className={styles.timerFill}
                        style={
                            {
                                animationDuration: `${Math.max(turnRemainingSec ?? turnTimeoutSec, 0)}s`,
                                "--timer-start": Math.min((turnRemainingSec ?? turnTimeoutSec) / turnTimeoutSec, 1)
                            } as React.CSSProperties
                        }
                    />
                </div>
                {turnRemainingSec !== undefined && <span className={styles.timerSeconds}>{turnRemainingSec}s</span>}
            </div>
        );
    }

    if (status !== undefined) {
        return (
            <div className={`${styles.banner} ${styles.status}${flip}`}>
                <span className={styles.label}>{status}</span>
            </div>
        );
    }

    return null;
};

export default SeatBanner;
