import React from "react";
import type { PlayerDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { PlayerSeating, type PlayerSeatingProps } from "./PlayerSeating";
import PlayingCard from "./PlayingCard";
import styles from "./TableBoard.module.css";

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export interface TableBoardProps extends Omit<PlayerSeatingProps, "players"> {
    players: PlayerDTO[];
    /** Community cards as SDK codes, e.g. "AS" — empty for preflop/not dealt yet. */
    communityCards: string[];
    pot: string;
    round: TexasHoldemRound;
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
    round,
    sitAndGoWaiting,
    waitingForPlayers,
    children,
    ...seatingProps
}) => {
    return (
        <div className={`pane ${styles.outer}`}>
            <div className={styles.feltBox}>
            <div className={styles.felt} />

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
                </div>
            ) : (
                <div className={styles.centerMessage}>
                    <div className={styles.potPill}>
                        <span className={styles.potChip} />
                        <span className={styles.potValue}>Pot ${pot}</span>
                    </div>
                    <div className={styles.communityCards}>
                        {Array.from({ length: 5 }, (_, i) => {
                            const code = communityCards[i];
                            return code !== undefined ? (
                                <PlayingCard key={i} code={code} className={styles.communityCard} />
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
