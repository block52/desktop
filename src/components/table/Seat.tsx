import React from "react";
import styles from "./Seat.module.css";

export interface SeatProps {
    /** Left/top position as percentages, from seatGeometry's getSeatPercent(). */
    left: number;
    top: number;
    occupied: boolean;
    /** It's this seat's turn to act. */
    isActive?: boolean;
    isSmallBlind?: boolean;
    isBigBlind?: boolean;
    isDealer?: boolean;
    /** Required when occupied. */
    name?: string;
    stack?: string;
    /** Current-round bet amount to display as a chip below the hole cards. Omit for no bet. */
    currentBet?: string;
    /** Whether to show face-down hole card placeholders (occupied, active-hand seats). */
    showCards?: boolean;
}

function SeatBadge({ isActive, isSmallBlind, isBigBlind, isDealer }: Pick<SeatProps, "isActive" | "isSmallBlind" | "isBigBlind" | "isDealer">) {
    if (isActive) {
        return <span className={styles.badge}>Turn</span>;
    }
    if (isSmallBlind) {
        return <span className={styles.badge}>SB</span>;
    }
    if (isBigBlind) {
        return <span className={styles.badge}>BB</span>;
    }
    if (isDealer) {
        return <span className={`${styles.badge} ${styles.badgeDealer}`}>D</span>;
    }
    return null;
}

export const Seat: React.FC<SeatProps> = ({
    left,
    top,
    occupied,
    isActive,
    isSmallBlind,
    isBigBlind,
    isDealer,
    name,
    stack,
    currentBet,
    showCards,
}) => {
    const style: React.CSSProperties = { left: `${left}%`, top: `${top}%` };

    if (!occupied) {
        return (
            <div className={`${styles.seat} ${styles.vacant}`} style={style}>
                <div className={styles.avatar}>
                    <span className={styles.plus}>+</span>
                </div>
                <div className={styles.nameplate}>
                    <div className={styles.name}>Empty</div>
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.seat} ${isActive ? styles.active : ""}`} style={style}>
            <SeatBadge isActive={isActive} isSmallBlind={isSmallBlind} isBigBlind={isBigBlind} isDealer={isDealer} />
            <div className={styles.avatar}>
                <svg className={styles.avatarIcon} viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                </svg>
            </div>
            <div className={styles.nameplate}>
                <div className={styles.name}>{name}</div>
                <div className={styles.stack}>{stack}</div>
            </div>
            {showCards && (
                <div className={styles.cards}>
                    <div className={styles.miniCard} />
                    <div className={styles.miniCard} />
                </div>
            )}
            {currentBet && <div className={styles.bet}>{currentBet}</div>}
        </div>
    );
};

export default Seat;
