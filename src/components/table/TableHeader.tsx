import React from "react";
import type { TexasHoldemRound } from "@block52/poker-vm-sdk";
import styles from "./TableHeader.module.css";

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export interface TableHeaderProps {
    tableLabel: string;
    smallBlind: string;
    bigBlind: string;
    handNumber: number;
    round: TexasHoldemRound;
    playerCount: number;
    maxPlayers: number;
    onLeave: () => void;
    leaveDisabled: boolean;
}

export const TableHeader: React.FC<TableHeaderProps> = ({
    tableLabel,
    smallBlind,
    bigBlind,
    handNumber,
    round,
    playerCount,
    maxPlayers,
    onLeave,
    leaveDisabled,
}) => {
    return (
        <div className={styles.header}>
            <div className={styles.club}>{tableLabel}</div>
            <div className={styles.meta}>
                <div className={styles.metaItem}>
                    <div className={styles.label}>Blinds</div>
                    <div className={styles.value}>
                        {smallBlind} / {bigBlind}
                    </div>
                </div>
                <div className={styles.metaItem}>
                    <div className={styles.label}>Hand</div>
                    <div className={styles.value}>#{handNumber}</div>
                </div>
                <div className={styles.metaItem}>
                    <div className={styles.label}>Round</div>
                    <div className={styles.value}>{capitalize(round)}</div>
                </div>
                <div className={styles.metaItem}>
                    <div className={styles.label}>Players</div>
                    <div className={styles.value}>
                        {playerCount}/{maxPlayers}
                    </div>
                </div>
            </div>
            <button className={styles.leaveButton} disabled={leaveDisabled} onClick={onLeave}>
                Leave Table
            </button>
        </div>
    );
};

export default TableHeader;
