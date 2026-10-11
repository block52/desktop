import React, { useEffect, useState } from "react";
import { blindLevelSecondsRemaining, formatCountdown } from "../../utils/blindLevel";
import styles from "./TournamentStrip.module.css";

export interface TournamentStripProps {
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
    prizes
}) => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const remaining = level !== undefined ? blindLevelSecondsRemaining(levelStartTime, levelDurationMinutes, now) : null;
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
            {hasNext && (
                <div className={styles.item}>
                    <span className="section-label">Next</span>
                    <span className={styles.value}>
                        {nextSmallBlind} / {nextBigBlind}
                        {remaining !== null && (
                            <span className={`${styles.countdown} ${remaining < 0 ? styles.overtime : ""}`}>in {formatCountdown(remaining)}</span>
                        )}
                    </span>
                </div>
            )}
            {prizes.length > 0 && (
                <div className={`${styles.item} ${styles.prizes}`}>
                    <span className="section-label">Prizes</span>
                    <span className={styles.value}>
                        {prizes.map(p => (
                            <span key={p.place} className={styles.prize}>
                                {ordinal(p.place)} <b>{p.amount}</b>
                            </span>
                        ))}
                    </span>
                </div>
            )}
        </div>
    );
};

export default TournamentStrip;
