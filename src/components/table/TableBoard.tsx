import React from "react";
import type { PlayerDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { PlayerSeating, type PlayerSeatingProps } from "./PlayerSeating";
import styles from "./TableBoard.module.css";

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export interface TableBoardProps extends Omit<PlayerSeatingProps, "players"> {
    players: PlayerDTO[];
    /** Community cards as display strings, e.g. "K♠" — empty for preflop/not dealt yet. */
    communityCards: string[];
    pot: string;
    round: TexasHoldemRound;
    /** When set, replaces the normal pot/cards display with a Sit & Go fill-progress message. */
    sitAndGoWaiting?: { prizePool: string; seated: number; maxPlayers: number };
    /** When set (and sitAndGoWaiting is not), shows a cash-table waiting message instead of pot/cards. */
    waitingForPlayers?: { seated: number; minPlayers: number; maxPlayers: number };
}

export const TableBoard: React.FC<TableBoardProps> = ({
    communityCards,
    pot,
    round,
    sitAndGoWaiting,
    waitingForPlayers,
    ...seatingProps
}) => {
    return (
        <div className={styles.outer}>
            <div className={styles.rail} />
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
                    <div className={styles.label}>Pot</div>
                    <div className={styles.value}>{pot}</div>
                    {communityCards.length > 0 && (
                        <div className={styles.communityCards}>
                            {communityCards.map((card, i) => (
                                <div key={i} className={styles.card}>
                                    {card}
                                </div>
                            ))}
                        </div>
                    )}
                    <div className={styles.roundLabel}>{capitalize(round)}</div>
                </div>
            )}

            <PlayerSeating {...seatingProps} />
        </div>
    );
};

export default TableBoard;
