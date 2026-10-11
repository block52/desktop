import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { isTournamentFormat, formatGameFormatDisplay, COSMOS_CONSTANTS, GameVariant } from "@block52/poker-vm-sdk";
import { useFindGames } from "../../hooks/useFindGames";
import type { GameWithFormat } from "../../hooks/useFindGames";
import CreateTableModal from "../modal/CreateTableModal";
import CopyButton from "../copyButton/CopyButton";
import { getCosmosAddress } from "../../utils/cosmos/storage";
import styles from "./TableList.module.css";

function microToUsdc(micro: string): string {
    return (Number(micro) / Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)).toFixed(2);
}

function shortId(gameId: string): string {
    return `${gameId.slice(0, 6)}…${gameId.slice(-4)}`;
}

/**
 * Single predicate for the Sit & Go bucket — used by both the segmented
 * counts and the row filter so the two can never disagree (previously
 * tournament-format games were excluded from every tab and vanished).
 */
function isSitAndGo(game: GameWithFormat): boolean {
    if (isTournamentFormat(game.gameFormat)) return true;
    const label = String(game.gameFormat).toLowerCase();
    return label.includes("sng") || label.includes("sit");
}

function variantLabel(game: GameWithFormat): string {
    if (game.gameVariant === GameVariant.TEXAS_HOLDEM) return "NLH";
    if (game.gameVariant === GameVariant.OMAHA) return "PLO";
    return String(game.gameVariant).toUpperCase();
}

function formatBlinds(game: GameWithFormat): string {
    if (isSitAndGo(game)) {
        return `${game.smallBlind} / ${game.bigBlind}`;
    }
    return `$${microToUsdc(game.smallBlind)} / $${microToUsdc(game.bigBlind)}`;
}

function formatBuyIn(game: GameWithFormat): string {
    if (isSitAndGo(game)) {
        return `$${microToUsdc(game.minBuyIn)}`;
    }
    return `$${microToUsdc(game.minBuyIn)} – $${microToUsdc(game.maxBuyIn)}`;
}

type FormatFilter = "all" | "cash" | "sit-and-go" | "mine";

interface TableListProps {
    search: string;
}

const TableList: React.FC<TableListProps> = ({ search }) => {
    const navigate = useNavigate();
    const { games: rawGames, isLoading, error, refetch } = useFindGames();

    const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
    const [showCreateModal, setShowCreateModal] = useState(false);

    const myAddress = getCosmosAddress()?.toLowerCase() ?? null;
    const isMine = (game: GameWithFormat): boolean =>
        myAddress !== null && game.creator !== undefined && game.creator.toLowerCase() === myAddress;

    const mineCount = rawGames.filter(isMine).length;
    const cashCount = useMemo(() => rawGames.filter(g => !isSitAndGo(g)).length, [rawGames]);
    const sngCount = useMemo(() => rawGames.filter(isSitAndGo).length, [rawGames]);

    const games = useMemo(() => {
        let list = rawGames;
        if (formatFilter === "mine") {
            list = list.filter(isMine);
        } else if (formatFilter !== "all") {
            list = list.filter(g => (formatFilter === "sit-and-go" ? isSitAndGo(g) : !isSitAndGo(g)));
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(
                g => g.gameId.toLowerCase().includes(q) || (g.name !== undefined && g.name.toLowerCase().includes(q))
            );
        }
        return list;
    }, [rawGames, search, formatFilter]);

    const headerRow = (
        <div className={styles.headerRow}>
            <h2 className={styles.title}>Tables</h2>
            <div className={styles.segmentedWrap}>
                <div className="segmented">
                    <button
                        className={formatFilter === "all" ? "seg on" : "seg"}
                        onClick={() => setFormatFilter("all")}
                    >
                        All <span className="seg-count">{rawGames.length}</span>
                    </button>
                    <button
                        className={formatFilter === "cash" ? "seg on" : "seg"}
                        onClick={() => setFormatFilter("cash")}
                    >
                        Cash <span className="seg-count">{cashCount}</span>
                    </button>
                    <button
                        className={formatFilter === "sit-and-go" ? "seg on" : "seg"}
                        onClick={() => setFormatFilter("sit-and-go")}
                    >
                        Sit &amp; Go <span className="seg-count">{sngCount}</span>
                    </button>
                    <button
                        className={formatFilter === "mine" ? "seg on" : "seg"}
                        onClick={() => setFormatFilter("mine")}
                    >
                        Mine <span className="seg-count">{mineCount}</span>
                    </button>
                </div>
            </div>
            <button className={`btn-ghost ${styles.createButton}`} onClick={() => setShowCreateModal(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M5 12h14" />
                    <path d="M12 5v14" />
                </svg>
                Create table
            </button>
        </div>
    );

    if (isLoading) {
        return (
            <div className={styles.container}>
                {headerRow}
                <div className={`pane-lite ${styles.panel}`}>
                    <div className={styles.stateBox}>
                        <div className={styles.spinner} />
                        <p className={styles.stateTitle}>Loading tables…</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                {headerRow}
                <div className={`pane-lite ${styles.panel}`}>
                    <div className={styles.stateBox}>
                        <div className={styles.errorIcon}>
                            <svg width="36" height="36" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <p className={styles.stateTitle}>Failed to load tables</p>
                        <p className={styles.stateText}>{error.message}</p>
                        <button onClick={() => refetch()} className={styles.retryBtn}>Retry</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {headerRow}

            <div className={`pane-lite ${styles.panel}`}>
                <div className={styles.gridHeader}>
                    <span className="section-label">Table</span>
                    <span className="section-label">Format</span>
                    <span className="section-label">Players</span>
                    <span className="section-label">Blinds</span>
                    <span className="section-label">Buy-in</span>
                    <span />
                </div>

                {games.length === 0 ? (
                    <div className={styles.stateBox}>
                        <div className={styles.emptyIcon}>
                            <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <p className={styles.stateTitle}>No tables available</p>
                        <p className={styles.stateText}>Create the first table to get started!</p>
                    </div>
                ) : (
                    games.map(game => {
                        const isSng = isSitAndGo(game);
                        const isFull = game.currentPlayers >= game.maxPlayers;
                        const fillPct = game.maxPlayers > 0
                            ? Math.round((game.currentPlayers / game.maxPlayers) * 100)
                            : 0;
                        const actionLabel = isFull ? "Watch" : isSng ? "Register" : "Join";

                        return (
                            <div
                                key={game.gameId}
                                className={`row-hover ${styles.row}${isMine(game) ? ` ${styles.rowMine}` : ""}`}
                                onClick={() => navigate(`/table/${game.gameId}`)}
                            >
                                <div className={styles.identity}>
                                    <span className={styles.feltIcon} />
                                    <div className={styles.identityText}>
                                        <span className={styles.tableName}>{game.name ?? shortId(game.gameId)}</span>
                                        <span className={styles.tableSubline}>
                                            <span className={styles.sublineId}>
                                                {shortId(game.gameId)}
                                                <CopyButton text={game.gameId} message="Table ID copied" title="Copy table ID" />
                                            </span>
                                            <span>· {variantLabel(game)}</span>
                                            {game.creator !== undefined && !isMine(game) && (
                                                <span>· by {shortId(game.creator)}</span>
                                            )}
                                            {isMine(game) && (
                                                <span>
                                                    ·
                                                    <span className={styles.mineBadge} title="Created by you" aria-label="Created by you">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                                            <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                                        </svg>
                                                        Yours
                                                    </span>
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                <span className={styles.formatCell}>
                                    {formatGameFormatDisplay(game.gameFormat)}
                                </span>

                                <div className={styles.playersCell}>
                                    <div className={styles.playerTrack}>
                                        <div className={styles.playerFill} style={{ width: `${fillPct}%` }} />
                                    </div>
                                    <span className={styles.playerCount}>
                                        {game.currentPlayers} / {game.maxPlayers}
                                    </span>
                                </div>

                                <span className={styles.blindsCell}>{formatBlinds(game)}</span>

                                <span className={styles.buyInCell}>{formatBuyIn(game)}</span>

                                <div className={styles.actionCell}>
                                    <button
                                        className={`btn-ghost ${styles.actionButton}`}
                                        onClick={e => {
                                            e.stopPropagation();
                                            navigate(`/table/${game.gameId}`);
                                        }}
                                    >
                                        {actionLabel}
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {showCreateModal && (
                <CreateTableModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={async (gameId: string) => {
                        await refetch();
                        navigate(`/table/${gameId}`);
                    }}
                />
            )}
        </div>
    );
};

export default TableList;
