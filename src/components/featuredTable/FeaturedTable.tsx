import React from "react";
import { useNavigate } from "react-router-dom";
import { COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import type { GameWithFormat } from "../../utils/convertUtils";
import styles from "./FeaturedTable.module.css";

interface FeaturedTableProps {
    game: GameWithFormat | null;
}

function microToUsdc(micro: string): string {
    return (Number(micro) / Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)).toFixed(2);
}

const FeaturedTable: React.FC<FeaturedTableProps> = ({ game }) => {
    const navigate = useNavigate();

    if (!game) return null;

    return (
        <div className={styles.card}>
            <div className={styles.badges}>
                <span className={styles.badgeSng}>SIT &amp; GO</span>
                <span className={styles.badgeStatus}>Starts when full</span>
            </div>
            <h3 className={styles.name}>
                {game.gameId.slice(0, 6)}…{game.gameId.slice(-4)}
            </h3>
            <div className={styles.meta}>
                <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Seats</span>
                    <span className={styles.metaValue}>{game.currentPlayers}/{game.maxPlayers}</span>
                </div>
                <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Buy-in</span>
                    <span className={styles.metaValue}>${microToUsdc(game.minBuyIn)}</span>
                </div>
            </div>
            <button
                className={styles.registerButton}
                onClick={() => navigate(`/table/${game.gameId}`)}
            >
                Register
            </button>
        </div>
    );
};

export default FeaturedTable;
