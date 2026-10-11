import React from "react";
import PlayingCard, { parseCard } from "./PlayingCard";
import ChipPile from "./ChipPile";
import SeatBanner, { type SeatBannerAction, type SeatStatusLabel } from "./SeatBanner";
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
    /** Required when occupied. Player addresses are never shown at the table, so this is a seat label. */
    name?: string;
    /** Shown in the avatar when the player has no NFT avatar. */
    seatNumber?: number;
    stack?: string;
    /** Stack as a 0–1 fraction of the max buy-in; drawn as the hero's stack bar. Omit for no bar. */
    stackFraction?: number;
    /** Current-round bet amount to display as a chip below the seat. Omit for no bet. */
    currentBet?: string;
    /** Hole cards (SDK codes) — rendered face-up when present. */
    holeCards?: string[];
    /** The seat's last action (amount pre-formatted), announced briefly under the nameplate. */
    lastAction?: SeatBannerAction;
    /** Seconds this seat has to act; drives the turn countdown while it is to act. */
    turnTimeoutSec?: number;
    /** Standing status shown under the nameplate when nothing else is. */
    statusLabel?: SeatStatusLabel;
    /** Someone has won this hand: every non-winning seat dims. */
    hasWinner?: boolean;
    /** Seated but not in the current hand (seated / sitting out / sitting in / busted). */
    isIdle?: boolean;
    /** Set when this seat won the pot: shows the win badge and highlights the seat. */
    winner?: { amount: string; description?: string };
    /** Final tournament placement for this seat's player; shows the place pill above the seat. */
    result?: { place: number; payout?: string };
    /** Codes of the cards in the winning hands; matching hole cards lift, the rest dim. */
    winningCards?: string[];
    /** Current-round bet as a whole-dollar/chip value; draws the chip pile above the bet pill. */
    betValue?: number;
    /** Raw `player.avatar` from table state (NFT ref or image URL). */
    avatar?: string;
    /** Vacant seats only: makes the seat clickable (e.g. to open the join modal). */
    onSelect?: () => void;
}

/** NFT avatar with gateway fallback; falls back to the seat number when nothing loads. */
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

const PLACE_SUFFIX: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };

/** Floating pill above a seat: the tournament place (with prize) when known, else the amount just won. */
/** Expanding rings behind the seat: white while it is this seat's turn, gold (plus rising chips) when it won. */
function Ripple({ kind, hero }: { kind: "turn" | "win"; hero?: boolean }) {
    return (
        <div className={`${styles.ripple} ${hero === true ? styles.rippleHero : ""}`} aria-hidden="true" data-testid={`ripple-${kind}`}>
            {[0, 1, 2, 3].map(i => (
                <div key={i} className={`${styles.ring} ${kind === "win" ? styles.ringWin : styles.ringTurn}`} />
            ))}
            {kind === "win" && (
                <ul className={styles.bubbles}>
                    {[0, 1, 2, 3, 4].map(i => (
                        <li key={i} />
                    ))}
                </ul>
            )}
        </div>
    );
}

function WinBadge({ winner, result }: { winner?: SeatProps["winner"]; result?: SeatProps["result"] }) {
    if (result !== undefined) {
        return (
            <div className={`${styles.winBadge} ${styles.placeBadge}`} role="status">
                <span className={styles.winAmount}>{PLACE_SUFFIX[result.place] ?? `${result.place}th`} place</span>
                {result.payout !== undefined && <span className={styles.winHand}>Won {result.payout}</span>}
            </div>
        );
    }
    if (winner === undefined) return null;
    return (
        <div className={styles.winBadge} role="status">
            <span className={styles.winAmount}>+{winner.amount}</span>
        </div>
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
    seatNumber,
    stack,
    stackFraction,
    currentBet,
    holeCards,
    hasWinner,
    isIdle,
    lastAction,
    turnTimeoutSec,
    statusLabel,
    winner,
    result,
    winningCards,
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
    const cardStateClass = (code: string): string => {
        if (winner === undefined || winningCards === undefined || winningCards.length === 0) return "";
        return winningCards.includes(code.toUpperCase()) ? styles.cardWin : styles.cardMuted;
    };

    if (isHero) {
        return (
            <div className={`${styles.seat} ${styles.hero} ${hasWinner === true && winner === undefined ? styles.lost : ""}`} style={style}>
                {winner !== undefined ? <Ripple kind="win" hero /> : isActive === true && <Ripple kind="turn" hero />}
                {hasCards && (
                    <div className={styles.heroCards}>
                        {holeCards.map((code, i) => (
                            <PlayingCard key={i} code={code} className={`${styles.heroCard} ${cardStateClass(code)}`} />
                        ))}
                    </div>
                )}
                <WinBadge winner={winner} result={result} />
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
                <SeatBanner lastAction={lastAction} isActive={isActive} turnTimeoutSec={turnTimeoutSec} status={statusLabel} winner={winner} />
                {currentBet && (
                <div className={styles.betBlock}>
                    {betValue !== undefined && <ChipPile amount={betValue} />}
                    <div className={styles.bet}>{currentBet}</div>
                </div>
            )}
            </div>
        );
    }

    const initials = seatNumber !== undefined ? String(seatNumber) : "?";

    return (
        <div className={`${styles.seat} ${isActive ? styles.active : ""} ${isFolded ? styles.folded : isIdle === true ? styles.idle : ""} ${hasWinner === true && winner === undefined ? styles.lost : ""}`} style={style}>
            {winner !== undefined ? <Ripple kind="win" /> : isActive === true && <Ripple kind="turn" />}
            <WinBadge winner={winner} result={result} />
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
            <SeatBanner lastAction={lastAction} isActive={isActive} turnTimeoutSec={turnTimeoutSec} status={statusLabel} winner={winner} />
            {hasCards && !isFolded && (
                <div className={styles.cards}>
                    {/* Hidden cards arrive as "X" placeholders and are drawn as card backs; revealed cards show their face. */}
                    {holeCards.map((code, i) => (
                        <PlayingCard key={i} code={code} faceDown={parseCard(code) === null} className={`${styles.holeCard} ${cardStateClass(code)}`} />
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
