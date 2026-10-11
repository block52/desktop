import React from "react";
import PlayingCard, { parseCard } from "./PlayingCard";
import ChipPile from "./ChipPile";
import { avatarImageCandidates } from "../../utils/playerAvatar";
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
    /** The seat's player has folded this hand — dimmed, stack replaced by "Folded". */
    isFolded?: boolean;
    /** The local player's seat — rendered as the large bottom-center hero panel. */
    isHero?: boolean;
    /** Required when occupied. */
    name?: string;
    stack?: string;
    /** Stack as a 0–1 fraction of the max buy-in; drawn as the hero's stack bar. Omit for no bar. */
    stackFraction?: number;
    /** Current-round bet amount to display as a chip below the seat. Omit for no bet. */
    currentBet?: string;
    /** Hole cards (SDK codes) — rendered face-up when present. */
    holeCards?: string[];
    /** Current-round bet as a whole-dollar/chip value; draws the chip pile above the bet pill. */
    betValue?: number;
    /** Raw `player.avatar` from table state (NFT ref or image URL). */
    avatar?: string;
    /** Vacant seats only: makes the seat clickable (e.g. to open the join modal). */
    onSelect?: () => void;
}

/** NFT avatar with gateway fallback; falls back to the player's initials when nothing loads. */
function AvatarFace({ avatar, initials }: { avatar?: string; initials: string }) {
    const candidates = React.useMemo(() => avatarImageCandidates(avatar), [avatar]);
    const [attempt, setAttempt] = React.useState({ avatar, index: 0 });
    const index = attempt.avatar === avatar ? attempt.index : 0;
    if (index >= candidates.length) {
        return <span className={styles.initials}>{initials}</span>;
    }
    return (
        <img
            className={styles.avatarImage}
            src={candidates[index]}
            alt="Player avatar"
            referrerPolicy="no-referrer"
            onError={() => setAttempt({ avatar, index: index + 1 })}
        />
    );
}

function BlindTag({ isSmallBlind, isBigBlind }: Pick<SeatProps, "isSmallBlind" | "isBigBlind">) {
    if (isBigBlind) {
        return <span className={styles.blindTag}>BB</span>;
    }
    if (isSmallBlind) {
        return <span className={styles.blindTag}>SB</span>;
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
    isFolded,
    isHero,
    name,
    stack,
    stackFraction,
    currentBet,
    holeCards,
    betValue,
    avatar,
    onSelect,
}) => {
    const style: React.CSSProperties = { left: `${left}%`, top: `${top}%` };

    if (!occupied) {
        if (onSelect !== undefined) {
            return (
                <button type="button" className={`${styles.seat} ${styles.vacant} ${styles.selectable}`} style={style} onClick={onSelect}>
                    <div className={styles.avatar}>
                        <span className={styles.plus}>+</span>
                    </div>
                    <div className={styles.openSeat}>Sit here</div>
                </button>
            );
        }
        return (
            <div className={`${styles.seat} ${styles.vacant}`} style={style}>
                <div className={styles.avatar}>
                    <span className={styles.plus}>+</span>
                </div>
                <div className={styles.openSeat}>Open seat</div>
            </div>
        );
    }

    const hasCards = holeCards !== undefined && holeCards.length > 0;

    if (isHero) {
        return (
            <div className={`${styles.seat} ${styles.hero}`} style={style}>
                {hasCards && (
                    <div className={styles.heroCards}>
                        {holeCards.map((code, i) => (
                            <PlayingCard key={i} code={code} className={styles.heroCard} />
                        ))}
                    </div>
                )}
                <div className={`${styles.heroPlate} ${hasCards ? styles.heroPlateWithCards : ""} ${isActive ? styles.heroPlateActive : ""}`}>
                    <div className={styles.heroNameRow}>
                        <span className={styles.heroName}>You</span>
                        <BlindTag isSmallBlind={isSmallBlind} isBigBlind={isBigBlind} />
                        {isDealer && <span className={styles.heroDealer}>D</span>}
                    </div>
                    <span className={styles.heroStack}>{isFolded ? "Folded" : stack}</span>
                    {stackFraction !== undefined && (
                        <div className={styles.stackTrack}>
                            <div className={styles.stackFill} style={{ width: `${Math.min(Math.max(stackFraction, 0), 1) * 100}%` }} />
                        </div>
                    )}
                </div>
                {currentBet && (
                <div className={styles.betBlock}>
                    {betValue !== undefined && <ChipPile amount={betValue} />}
                    <div className={styles.bet}>{currentBet}</div>
                </div>
            )}
            </div>
        );
    }

    const initials = (name ?? "?").replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "?";

    return (
        <div className={`${styles.seat} ${isActive ? styles.active : ""} ${isFolded ? styles.folded : ""}`} style={style}>
            <div className={styles.avatar}>
                <AvatarFace avatar={avatar} initials={initials} />
                {isDealer && <span className={styles.dealer}>D</span>}
            </div>
            <div className={styles.nameplate}>
                <div className={styles.nameRow}>
                    <span className={styles.name}>{name}</span>
                    <BlindTag isSmallBlind={isSmallBlind} isBigBlind={isBigBlind} />
                </div>
                <div className={`${styles.stack} ${isFolded ? styles.stackMuted : ""}`}>{isFolded ? "Folded" : stack}</div>
            </div>
            {hasCards && !isFolded && (
                <div className={styles.cards}>
                    {/* Hidden cards arrive as "X" placeholders and are drawn as card backs; revealed cards show their face. */}
                    {holeCards.map((code, i) => (
                        <PlayingCard key={i} code={code} faceDown={parseCard(code) === null} className={styles.holeCard} />
                    ))}
                </div>
            )}
            {currentBet && (
                <div className={styles.betBlock}>
                    {betValue !== undefined && <ChipPile amount={betValue} />}
                    <div className={styles.bet}>{currentBet}</div>
                </div>
            )}
        </div>
    );
};

export default Seat;
