import React, { useEffect, useState } from "react";
import { timeLeft, urgencyOf } from "../../utils/tournaments";
import styles from "./TournamentCountdown.module.css";

interface TournamentCountdownProps {
    /** The start time in milliseconds; 0 or less means it starts when the field is full. */
    startTime: number;
    entrants: number;
    minEntrants: number;
}

const pad = (value: number): string => String(value).padStart(2, "0");

/** A tile whose digits flip whenever the value changes (the key restarts the animation). */
const Tile: React.FC<{ value: string; label: string }> = ({ value, label }) => (
    <div className={styles.tile}>
        <div className={styles.digits} aria-hidden="true">
            <span key={value} className={styles.digit}>
                {value}
            </span>
        </div>
        <span className={styles.label}>{label}</span>
    </div>
);

/** Counts down to a tournament's start; warms up in the last hour, pulses in the last minute, and counts the final ten seconds. */
const TournamentCountdown: React.FC<TournamentCountdownProps> = ({ startTime, entrants, minEntrants }) => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const missing = Math.max(minEntrants - entrants, 0);
    const needMore = missing > 0 ? `${missing} more ${missing === 1 ? "player is" : "players are"} needed to start` : "";

    if (startTime <= 0) {
        return (
            <div className={`pane-lite ${styles.card}`}>
                <span className={styles.kicker}>Starts when the field is full</span>
                {needMore !== "" && <p className={styles.message}>{needMore}</p>}
            </div>
        );
    }

    const left = timeLeft(startTime, now);
    if (left.done) {
        return (
            <div className={`pane-lite ${styles.card}`}>
                <span className={styles.go}>{missing === 0 ? "Shuffle up and deal!" : "Waiting for players…"}</span>
                {needMore !== "" && <p className={styles.message}>{needMore}</p>}
            </div>
        );
    }

    const spoken = left.days > 0 ? `${left.days} days ${left.hours} hours` : `${left.hours} hours ${left.minutes} minutes ${left.seconds} seconds`;
    return (
        <div className={`pane-lite ${styles.card} ${styles[urgencyOf(left.totalSeconds)]}`} role="timer" aria-label={`Starts in ${spoken}`}>
            <span className={styles.kicker}>{left.totalSeconds <= 10 ? "Get ready" : "Starts in"}</span>
            <div className={styles.tiles}>
                {left.days > 0 && <Tile value={pad(left.days)} label="days" />}
                {(left.days > 0 || left.hours > 0) && <Tile value={pad(left.hours)} label="hours" />}
                {(left.days > 0 || left.hours > 0 || left.minutes > 0) && <Tile value={pad(left.minutes)} label="min" />}
                <Tile value={left.totalSeconds <= 10 ? String(left.seconds) : pad(left.seconds)} label="sec" />
            </div>
            {needMore !== "" && <p className={styles.message}>{needMore}</p>}
        </div>
    );
};

export default TournamentCountdown;
