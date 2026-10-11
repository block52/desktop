import React from "react";
import { useNavigate } from "react-router-dom";
import { COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import type { GameWithFormat } from "../../utils/convertUtils";
import cardAceSpadesUrl from "../../assets/lobby/card-ace-spades.svg";
import cardKingSpadesUrl from "../../assets/lobby/card-king-spades.svg";
import cardNineHeartsUrl from "../../assets/lobby/card-nine-hearts.svg";
import styles from "./FeaturedTable.module.css";

interface FeaturedTableProps {
    game: GameWithFormat | null;
}

function microToUsdc(micro: string): string {
    return (Number(micro) / Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)).toFixed(2);
}

function shortId(gameId: string): string {
    return `${gameId.slice(0, 6)}…${gameId.slice(-4)}`;
}

const FeaturedTable: React.FC<FeaturedTableProps> = ({ game }) => {
    const navigate = useNavigate();

    if (!game) return null;

    const buyInUsdc = microToUsdc(game.minBuyIn);
    const prizePoolUsdc = (
        (Number(game.minBuyIn) * game.maxPlayers * 0.9) /
        Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)
    ).toFixed(2);

    return (
        <div className={styles.hero}>
            <div className={styles.tableEllipse} />
            <div className={styles.cards}>
                <img src={cardAceSpadesUrl} alt="Ace of spades" className={styles.cardImg} />
                <img src={cardKingSpadesUrl} alt="King of spades" className={styles.cardImg} />
                <img src={cardNineHeartsUrl} alt="Nine of hearts" className={styles.cardImg} />
            </div>

            <div className={styles.badges}>
                <span className={styles.badgeSng}>SIT &amp; GO</span>
                <span className={styles.badgeStatus}>Starts when full</span>
            </div>

            <div className={styles.textBlock}>
                <div className={styles.heroTitle}>{game.name ?? shortId(game.gameId)}</div>
                <div className={styles.heroDescription}>
                    Starts when full. Winner takes the pot — every hand settled on-chain.
                </div>
            </div>

            <div className={styles.footer}>
                <button
                    className={`btn-glow shimmer-hover ${styles.registerButton}`}
                    onClick={() => navigate(`/table/${game.gameId}`)}
                >
                    Register · ${buyInUsdc}
                </button>
                <div className={styles.metaStack}>
                    <span className={`section-label ${styles.metaLabel}`}>Seats</span>
                    <span className={styles.metaValue}>
                        {game.currentPlayers} / {game.maxPlayers}
                    </span>
                </div>
                <div className={styles.metaStack}>
                    <span className={`section-label ${styles.metaLabel}`}>Prize</span>
                    <span className={styles.prizeValue}>${prizePoolUsdc}</span>
                </div>
            </div>
        </div>
    );
};

export default FeaturedTable;
