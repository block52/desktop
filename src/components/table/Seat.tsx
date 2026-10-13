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
    turnRemainingSec?: number;
    turnKey?: string;
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
    /** Win chance (0-100) while the hand is all-in or at showdown; shown as a pill above the seat. */
    equity?: number;
    /** Codes of the cards in the winning hands; matching hole cards lift, the rest dim. */
    winningCards?: string[];
    /** Current-round bet as a whole-dollar/chip value; draws the chip pile above the bet pill. */
    betValue?: number;
    /** Raw `player.avatar` from table state (NFT ref or image URL). */
    avatar?: string;
    /** Hero seat only: shown just under the panel without taking part in its layout (the blind / deal steps). */
    footer?: React.ReactNode;
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

const RING_RADIUS = 31;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const URGENT_SECONDS = 5;

/** The turn clock drawn around an avatar: an arc that drains over the time left, with the seconds in the middle. */
function TurnRing({ timeoutSec, remainingSec, turnKey }: { timeoutSec: number; remainingSec?: number; turnKey?: string }) {
    const left = Math.max(remainingSec ?? timeoutSec, 0);
    const startFraction = Math.min(left / timeoutSec, 1);
    const urgent = remainingSec !== undefined && remainingSec <= URGENT_SECONDS;
    return (
        <div className={`${styles.turnRing} ${urgent ? styles.turnRingUrgent : ""}`} role="timer" aria-label="Time to act">
            <svg className={styles.turnRingSvg} viewBox="0 0 66 66" aria-hidden="true">
                <circle className={styles.turnRingTrack} cx="33" cy="33" r={RING_RADIUS} />
                <circle
                    key={turnKey}
                    className={styles.turnRingArc}
                    cx="33"
                    cy="33"
                    r={RING_RADIUS}
                    style={
                        {
                            strokeDasharray: RING_CIRCUMFERENCE,
                            "--ring-from": RING_CIRCUMFERENCE * (1 - startFraction),
                            "--ring-to": RING_CIRCUMFERENCE,
                            animationDuration: `${left}s`
                        } as React.CSSProperties
                    }
                />
            </svg>
            {remainingSec !== undefined && <span className={styles.turnRingSeconds}>{remainingSec}</span>}
        </div>
    );
}

const ACTION_CHIPS: Record<string, { label: string; tone: "good" | "warm" | "hot" | "cool" }> = {
    check: { label: "Check", tone: "good" },
    call: { label: "Call", tone: "good" },
    bet: { label: "Bet", tone: "warm" },
    raise: { label: "Raise", tone: "warm" },
    "all-in": { label: "All-in", tone: "hot" },
    fold: { label: "Fold", tone: "cool" }
};

/** The seat's latest action kept on the avatar for the rest of the street (blind posts are shown by the SB/BB tags). */
function ActionChip({ action }: { action?: string }) {
    const chip = action !== undefined ? ACTION_CHIPS[action] : undefined;
    if (chip === undefined) return null;
    return <span className={`${styles.actionChip} ${styles[`actionChip_${chip.tone}`]}`}>{chip.label}</span>;
}

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

function WinBadge({ winner, result, equity }: { winner?: SeatProps["winner"]; result?: SeatProps["result"]; equity?: number }) {
    if (result !== undefined) {
        return (
            <div className={`${styles.winBadge} ${styles.placeBadge}`} role="status">
                <span className={styles.winAmount}>{PLACE_SUFFIX[result.place] ?? `${result.place}th`} place</span>
                {result.payout !== undefined && <span className={styles.winHand}>Won {result.payout}</span>}
            </div>
        );
    }
    if (winner === undefined) {
        if (equity === undefined) return null;
        return (
            <div className={`${styles.winBadge} ${styles.equityBadge}`} role="status" aria-label={`Win chance ${Math.round(equity)} percent`}>
                <span className={styles.winAmount}>{Math.round(equity)}%</span>
            </div>
        );
    }
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

/** Half the avatar's height: where the seat's coordinate sits when the box has no avatar element. */
const AVATAR_HALF_PX = 28;
/** Breathing room kept between a seat's content and the edge of the pane. */
const PANE_EDGE_GAP_PX = 4;
/** Room kept under the hero panel for the blind / deal step buttons docked at the pane's bottom. */
const HERO_FOOTER_RESERVE_PX = 64;
/** How far the floating win / place pill overhangs the top of the seat box (it is out of flow). */
/* The pill overhangs by ~22px; a winning hole card lifts 14px, so this covers both. */
const RESULT_PILL_OVERHANG_PX = 26;

interface SeatExtents {
    /** Content height from the box's top edge to the seat's coordinate (the avatar's centre). */
    above: number;
    /** Content height from the seat's coordinate to the box's bottom edge. */
    below: number;
}

/** Tracks how far a seat's content reaches above and below its coordinate, so it can stay inside the pane. */
function useSeatExtents(): [(el: HTMLElement | null) => void, SeatExtents] {
    const [extents, setExtents] = React.useState<SeatExtents>({ above: 0, below: 0 });
    const observer = React.useRef<ResizeObserver | null>(null);
    const ref = React.useCallback((el: HTMLElement | null) => {
        observer.current?.disconnect();
        observer.current = null;
        if (el === null) return;
        const measure = () => {
            const avatar = el.querySelector<HTMLElement>("[data-seat-avatar]");
            // The hero panel has no avatar and sits 30% of its height above its coordinate.
            const above = avatar !== null ? avatar.offsetTop + avatar.offsetHeight / 2 : el.dataset.seatHero !== undefined ? el.offsetHeight * 0.3 : AVATAR_HALF_PX;
            // The hero's step buttons hang below its panel: keep room for them so they never leave the pane.
            const footerReserve = el.dataset.seatHero !== undefined ? HERO_FOOTER_RESERVE_PX : 0;
            setExtents({ above, below: el.offsetHeight - above + footerReserve });
        };
        measure();
        const next = new ResizeObserver(measure);
        next.observe(el);
        observer.current = next;
    }, []);
    return [ref, extents];
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
    turnRemainingSec,
    turnKey,
    statusLabel,
    winner,
    equity,
    result,
    winningCards,
    betValue,
    avatar,
    footer,
    onSelect,
}) => {
    // Upper-half seats hang their badge and cards above the avatar, lower-half seats below it. The
    // percentage coordinate alone can push that content out of the pane and clip it on a short window,
    // so the seat measures its own box and never sits closer to an edge than its content needs.
    const [boxRef, { above, below }] = useSeatExtents();
    const seatTop =
        top < 50
            ? `max(${top}%, ${above + RESULT_PILL_OVERHANG_PX + PANE_EDGE_GAP_PX}px)`
            : `min(${top}%, calc(100% - ${below + PANE_EDGE_GAP_PX}px - var(--action-reserve, 0px)))`;
    const style: React.CSSProperties = { left: `${left}%`, top: seatTop };

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

    const betBlock = (extraClass: string) =>
        currentBet !== undefined && currentBet !== "" ? (
            <div className={`${styles.betBlock} ${extraClass}`}>
                {betValue !== undefined && <ChipPile amount={betValue} />}
                <div className={styles.bet}>{currentBet}</div>
            </div>
        ) : null;
    if (isHero) {
        return (
            <div ref={boxRef} data-seat-hero className={`${styles.seat} ${styles.hero} ${hasWinner === true && winner === undefined ? styles.lost : ""}`} style={style}>
                {winner !== undefined ? <Ripple kind="win" hero /> : isActive === true && <Ripple kind="turn" hero />}
                {hasCards && (
                    <div className={styles.heroCards}>
                        {holeCards.map((code, i) => (
                            <PlayingCard key={i} code={code} className={`${styles.heroCard} ${cardStateClass(code)}`} />
                        ))}
                        {betBlock(`${styles.betBeside} ${styles.betRight}`)}
                    </div>
                )}
                <WinBadge winner={winner} result={result} equity={equity} />
                <div className={`${styles.heroPlate} ${hasCards ? styles.heroPlateWithCards : ""} ${isActive ? styles.heroPlateActive : ""}`}>
                    {isActive === true && turnTimeoutSec !== undefined && turnTimeoutSec > 0 && (
                        <div className={styles.heroClock}>
                            <TurnRing timeoutSec={turnTimeoutSec} remainingSec={turnRemainingSec} turnKey={turnKey} />
                        </div>
                    )}
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
                <SeatBanner lastAction={lastAction} isActive={isActive} turnTimeoutSec={turnTimeoutSec} turnRemainingSec={turnRemainingSec} turnKey={turnKey} status={statusLabel} winner={winner} />
                {!hasCards && betBlock("")}
                {footer !== undefined && <div className={styles.heroFooter}>{footer}</div>}
            </div>
        );
    }

    const initials = seatNumber !== undefined ? String(seatNumber) : "?";
    // Seats in the upper half hang their badge and cards above the avatar, away from the table centre.
    const isUpper = top < 50;

    return (
        <div ref={boxRef} className={`${styles.seat} ${isUpper ? styles.upper : ""} ${isActive ? styles.active : ""} ${isFolded ? styles.folded : isIdle === true ? styles.idle : ""} ${hasWinner === true && winner === undefined ? styles.lost : ""}`} style={style}>
            {winner !== undefined ? <Ripple kind="win" /> : isActive === true && <Ripple kind="turn" />}
            <WinBadge winner={winner} result={result} equity={equity} />
            <div className={styles.avatar} data-seat-avatar>
                <AvatarFace avatar={avatar} initials={initials} />
                {isActive === true && turnTimeoutSec !== undefined && turnTimeoutSec > 0 && (
                    <TurnRing timeoutSec={turnTimeoutSec} remainingSec={turnRemainingSec} turnKey={turnKey} />
                )}
                {isDealer && <span className={styles.dealer}>D</span>}
                {!isFolded && <ActionChip action={lastAction?.action} />}
                {isFolded && <ActionChip action="fold" />}
            </div>
            <div className={styles.nameplate}>
                <div className={styles.nameRow}>
                    <span className={styles.name}>{name}</span>
                    <BlindTag isSmallBlind={isSmallBlind} isBigBlind={isBigBlind} />
                </div>
                <div className={`${styles.stack} ${isFolded ? styles.stackMuted : ""}`}>{isFolded ? "Folded" : stack}</div>
            </div>
            <SeatBanner lastAction={lastAction} status={statusLabel} winner={winner} flipped={isUpper} />
            {hasCards && !isFolded && (
                <div className={styles.cards}>
                    {/* Hidden cards arrive as "X" placeholders and are drawn as card backs; revealed cards show their face. */}
                    {holeCards.map((code, i) => (
                        <PlayingCard key={i} code={code} faceDown={parseCard(code) === null} className={`${styles.holeCard} ${cardStateClass(code)}`} />
                    ))}
                    {/* The bet sits beside the cards: off the felt for upper seats, clear of the pane edge for lower ones. */}
                    {betBlock(`${styles.betBeside} ${left < 50 ? styles.betLeft : styles.betRight}`)}
                </div>
            )}
            {!(hasCards && !isFolded) && betBlock(isUpper ? `${styles.betSide} ${left < 50 ? styles.betLeft : styles.betRight}` : "")}
        </div>
    );
};

export default Seat;
