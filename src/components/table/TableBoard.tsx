import React from "react";
import type { PlayerDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { PlayerSeating, type PlayerSeatingProps } from "./PlayerSeating";
import PlayingCard from "./PlayingCard";
import ChipPile from "./ChipPile";
import NounsGlasses from "./NounsGlasses";
import type { TableTheme } from "../../config/tableTheme";
import styles from "./TableBoard.module.css";

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export interface TableBoardProps extends Omit<PlayerSeatingProps, "players"> {
    players: PlayerDTO[];
    /** Community cards as SDK codes, e.g. "AS" — empty for preflop/not dealt yet. */
    communityCards: string[];
    /** Formatted total pot (main pot + current round bets), currency symbol included. */
    pot: string;
    /** Whether the total pot has chips in it; an empty pot is hidden while waiting for players. */
    hasPot: boolean;
    /** Total pot as a whole-dollar/chip value, for the chip pile. */
    potValue: number;
    /** Formatted main pot (currency symbol included), set only when it differs from the total pot (post-flop side bets). */
    mainPot?: string;
    round: TexasHoldemRound;
    /** Visual theme of the rail, felt and background. */
    theme?: TableTheme;
    /** When set, replaces the normal pot/cards display with a Sit & Go fill-progress message. */
    sitAndGoWaiting?: { prizePool: string; seated: number; maxPlayers: number };
    /** When set (and sitAndGoWaiting is not), shows a cash-table waiting message instead of pot/cards. */
    waitingForPlayers?: { seated: number; minPlayers: number; maxPlayers: number };
    /** Overlay content (e.g. the hand log) rendered over the felt pane. */
    children?: React.ReactNode;
}

export const TableBoard: React.FC<TableBoardProps> = ({
    communityCards,
    pot,
    hasPot,
    potValue,
    mainPot,
    round,
    theme = "modern",
    sitAndGoWaiting,
    waitingForPlayers,
    children,
    ...seatingProps
}) => {
    const winningCards = seatingProps.winningCards ?? [];
    const potDisplay = (
        <div className={styles.potStack}>
            {hasPot && <ChipPile amount={potValue} />}
            <div className={styles.potPill}>
                <span className={styles.potChip} />
                <span className={styles.potValue}>Total pot {pot}</span>
            </div>
            {mainPot !== undefined && <div className={styles.mainPot}>Main pot {mainPot}</div>}
        </div>
    );

    return (
        <div className={`pane ${styles.outer} ${styles[`theme_${theme}`]}`}>
            <div className={styles.feltBox}>
            <div className={styles.felt}>{theme === "nouns" && <NounsGlasses className={styles.nounsLogo} />}</div>

            {sitAndGoWaiting ? (
                <div className={styles.centerMessage}>
                    <div className={styles.label}>Prize pool</div>
                    <div className={styles.value}>{sitAndGoWaiting.prizePool}</div>
                    <div className={styles.sub}>
                        {sitAndGoWaiting.seated} / {sitAndGoWaiting.maxPlayers} joined — starts automatically when full
                    </div>
                </div>
            ) : waitingForPlayers ? (
                <div className={styles.centerMessage}>
                    <div className={styles.label}>Waiting for players</div>
                    <div className={styles.value}>
                        {waitingForPlayers.seated} / {waitingForPlayers.maxPlayers} seated
                    </div>
                    <div className={styles.sub}>Hand starts automatically once {waitingForPlayers.minPlayers}+ players are ready</div>
                    {hasPot && potDisplay}
                </div>
            ) : (
                <div className={styles.centerMessage}>
                    {potDisplay}
                    <div className={styles.communityCards}>
                        {Array.from({ length: 5 }, (_, i) => {
                            const code = communityCards[i];
                            return code !== undefined ? (
                                <PlayingCard
                                    key={i}
                                    code={code}
                                    className={`${styles.communityCard} ${
                                        winningCards.length === 0 ? "" : winningCards.includes(code.toUpperCase()) ? styles.communityWin : styles.communityMuted
                                    }`}
                                />
                            ) : (
                                <div key={i} className={styles.emptyCard} />
                            );
                        })}
                    </div>
                    <div className={styles.roundLabel}>{capitalize(round)}</div>
                </div>
            )}
            </div>

            <PlayerSeating {...seatingProps} />
            {children}
        </div>
    );
};

export default TableBoard;
