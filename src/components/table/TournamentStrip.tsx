import React, { useEffect, useState } from "react";
import { blindLevelSecondsRemaining, formatCountdown } from "../../utils/blindLevel";
import styles from "./TournamentStrip.module.css";

interface TournamentStripProps {
    /** 0-based level reported by the chain; undefined before the tournament starts. */
    level: number | undefined;
    smallBlind: string;
    bigBlind: string;
    nextSmallBlind: string | undefined;
    nextBigBlind: string | undefined;
    levelStartTime: number | undefined;
    /** Minutes per blind level. */
    levelDurationMinutes: number;
    /** Prize places, first place first; amounts already formatted for display. */
    prizes: Array<{ place: number; amount: string }>;
    /** The tournament has ended: there is no next level to count down to. */
    isFinished?: boolean;
}

const ORDINALS = ["1st", "2nd", "3rd"];
const ordinal = (place: number): string => ORDINALS[place - 1] ?? `${place}th`;

/** Sit & Go context under the header: blind level, the next blinds with a countdown, and the prize places. */
export const TournamentStrip: React.FC<TournamentStripProps> = ({
    level,
    smallBlind,
    bigBlind,
    nextSmallBlind,
    nextBigBlind,
    levelStartTime,
    levelDurationMinutes,
    prizes,
    isFinished = false
}) => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const remaining = level !== undefined && !isFinished ? blindLevelSecondsRemaining(levelStartTime, levelDurationMinutes, now) : null;
    const hasNext = nextSmallBlind !== undefined && nextBigBlind !== undefined;

    return (
        <div className={`pane-lite ${styles.strip}`}>
            <div className={styles.item}>
                <span className="section-label">Level</span>
                <span className={styles.value}>{level !== undefined ? level + 1 : "—"}</span>
            </div>
            <div className={styles.item}>
                <span className="section-label">Blinds</span>
                <span className={styles.value}>
                    {smallBlind} / {bigBlind}
                </span>
            </div>
            {isFinished && (
                <div className={styles.item}>
                    <span className="section-label">Status</span>
                    <span className={styles.value}>Finished</span>
                </div>
            )}
            {hasNext && !isFinished && (
                <div className={styles.item}>
                    <span className="section-label">Next</span>
                    <span className={styles.value}>
                        {nextSmallBlind} / {nextBigBlind}
                        {remaining !== null && (
                            <span className={`${styles.countdown} ${remaining < 0 ? styles.overtime : ""}`}>
                                {remaining < 0 ? "level change due" : `in ${formatCountdown(remaining)}`}
                            </span>
                        )}
                    </span>
                </div>
            )}
            {prizes.length > 0 && (
                <div className={`${styles.item} ${styles.prizes}`}>
                    <span className="section-label">Prizes</span>
                    <span className={styles.value}>
                        {prizes.map(prize => (
                            <span key={prize.place} className={styles.prize}>
                                {ordinal(prize.place)} <b>{prize.amount}</b>
                            </span>
                        ))}
                    </span>
                </div>
            )}
        </div>
    );
};

export default TournamentStrip;
