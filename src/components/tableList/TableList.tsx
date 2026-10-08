import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { isTournamentFormat, formatGameFormatDisplay, formatGameVariantDisplay, COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import { useFindGames } from "../../hooks/useFindGames";
import type { GameWithFormat } from "../../hooks/useFindGames";
import { useToast } from "../../context/ToastContext";
import styles from "./TableList.module.css";

const PAGE_SIZE = 20;

function microToUsdc(micro: string): string {
    return (Number(micro) / Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)).toFixed(2);
}

function formatBuyIn(game: GameWithFormat): string {
    if (isTournamentFormat(game.gameFormat)) {
        const total = parseFloat(microToUsdc(game.minBuyIn));
        const fee   = +(total * 0.1).toFixed(2);
        const prize = +(total - fee).toFixed(2);
        return `$${total.toFixed(2)} (${prize} + ${fee})`;
    }
    return `$${microToUsdc(game.minBuyIn)} – $${microToUsdc(game.maxBuyIn)}`;
}

function badgeClass(game: GameWithFormat): string {
    if (isTournamentFormat(game.gameFormat)) return styles.badgeTournament;
    const label = String(game.gameFormat).toLowerCase();
    if (label.includes("sng") || label.includes("sit")) return styles.badgeSng;
    return styles.badgeCash;
}

type SortKey = "players" | "format" | "buyIn" | null;
type SortDir = "asc" | "desc";

const TableList: React.FC = () => {
    const navigate    = useNavigate();
    const { showSuccess } = useToast();
    const { games: rawGames, isLoading, error, refetch } = useFindGames();

    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch]         = useState("");
    const [sortKey, setSortKey]       = useState<SortKey>(null);
    const [sortDir, setSortDir]       = useState<SortDir>("desc");
    const [page, setPage]             = useState(1);

    const handleSort = useCallback((key: SortKey) => {
        setSortKey(prev => {
            if (prev === key) setSortDir(d => d === "asc" ? "desc" : "asc");
            else setSortDir("desc");
            return key;
        });
        setPage(1);
    }, []);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    const copyId = useCallback((id: string) => {
        navigator.clipboard.writeText(id);
        showSuccess("Table ID copied");
    }, [showSuccess]);

    const games = useMemo(() => {
        let list = rawGames;
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(g => g.gameId.toLowerCase().includes(q));
        }
        if (sortKey === "players") {
            list = [...list].sort((a, b) => sortDir === "desc"
                ? b.currentPlayers - a.currentPlayers
                : a.currentPlayers - b.currentPlayers);
        } else if (sortKey === "format") {
            list = [...list].sort((a, b) => {
                const cmp = String(a.gameFormat).localeCompare(String(b.gameFormat));
                return sortDir === "asc" ? cmp : -cmp;
            });
        } else if (sortKey === "buyIn") {
            list = [...list].sort((a, b) => {
                const diff = Number(a.minBuyIn) - Number(b.minBuyIn);
                return sortDir === "asc" ? diff : -diff;
            });
        }
        return list;
    }, [rawGames, search, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(games.length / PAGE_SIZE));
    const paged = games.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const SortArrow = ({ col }: { col: SortKey }) => (
        sortKey === col
            ? <span>{sortDir === "asc" ? " ↑" : " ↓"}</span>
            : <span style={{ opacity: 0.3 }}> ↕</span>
    );

    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.header}><h2 className={styles.title}>Available Tables</h2></div>
                <div className={styles.stateBox}>
                    <div className={styles.spinner} />
                    <p className={styles.stateTitle}>Loading tables…</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.header}><h2 className={styles.title}>Available Tables</h2></div>
                <div className={styles.stateBox}>
                    <div className={styles.errorIcon}>
                        <svg width="36" height="36" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <p className={styles.stateTitle}>Failed to load tables</p>
                    <p className={styles.stateText}>{error.message}</p>
                    <button onClick={handleRefresh} className={styles.retryBtn}>Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>Available Tables</h2>
                <span className={styles.count}>{games.length}</span>
                <div className={styles.spacer} />
                <div className={styles.searchWrap}>
                    <svg className={styles.searchIcon} width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
                    </svg>
                    <input
                        type="text"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search by table ID…"
                        className={styles.searchInput}
                    />
                </div>
                <button onClick={handleRefresh} disabled={refreshing} className={styles.refreshBtn} title="Refresh">
                    <svg className={refreshing ? styles.spinning : ""} width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <thead className={styles.thead}>
                        <tr>
                            <th className={styles.th}>Table ID</th>
                            <th className={`${styles.th} ${styles.thCenter}`}>
                                <button className={styles.sortBtn} onClick={() => handleSort("format")}>
                                    Format<SortArrow col="format" />
                                </button>
                            </th>
                            <th className={`${styles.th} ${styles.thCenter}`}>Variant</th>
                            <th className={`${styles.th} ${styles.thCenter}`}>Stakes</th>
                            <th className={`${styles.th} ${styles.thCenter}`}>
                                <button className={styles.sortBtn} onClick={() => handleSort("buyIn")}>
                                    Buy-In<SortArrow col="buyIn" />
                                </button>
                            </th>
                            <th className={`${styles.th} ${styles.thCenter}`}>
                                <button className={styles.sortBtn} onClick={() => handleSort("players")}>
                                    Players<SortArrow col="players" />
                                </button>
                            </th>
                            <th className={`${styles.th} ${styles.thCenter}`}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paged.length === 0 ? (
                            <tr>
                                <td colSpan={7} className={styles.td}>
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
                                </td>
                            </tr>
                        ) : paged.map(game => {
                            const isTournament = isTournamentFormat(game.gameFormat);
                            const isFull = game.currentPlayers >= game.maxPlayers;
                            const fillPct = game.maxPlayers > 0
                                ? Math.round((game.currentPlayers / game.maxPlayers) * 100)
                                : 0;

                            return (
                                <tr key={game.gameId} className={styles.tr}>
                                    <td className={styles.td}>
                                        <div className={styles.gameId}>
                                            <span>{game.gameId.slice(0, 6)}…{game.gameId.slice(-4)}</span>
                                            <button className={styles.copyBtn} onClick={() => copyId(game.gameId)} title="Copy ID">
                                                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>

                                    <td className={`${styles.td} ${styles.tdCenter}`}>
                                        <span className={`${styles.badge} ${badgeClass(game)}`}>
                                            {formatGameFormatDisplay(game.gameFormat)}
                                        </span>
                                    </td>

                                    <td className={`${styles.td} ${styles.tdCenter}`}>
                                        <span className={styles.variant}>{formatGameVariantDisplay(game.gameVariant)}</span>
                                    </td>

                                    <td className={`${styles.td} ${styles.tdCenter}`}>
                                        {!isTournament ? (
                                            <span className={styles.stakes}>
                                                ${microToUsdc(game.smallBlind)} / ${microToUsdc(game.bigBlind)}
                                            </span>
                                        ) : (
                                            <span className={styles.dash}>—</span>
                                        )}
                                    </td>

                                    <td className={`${styles.td} ${styles.tdCenter}`}>
                                        <span className={styles.buyIn}>{formatBuyIn(game)}</span>
                                    </td>

                                    <td className={`${styles.td} ${styles.tdCenter}`}>
                                        <div className={styles.playerBar}>
                                            <span className={styles.playerCount}>{game.currentPlayers}/{game.maxPlayers}</span>
                                            <div className={styles.playerTrack}>
                                                <div
                                                    className={`${styles.playerFill} ${isFull ? styles.playerFillFull : ""}`}
                                                    style={{ width: `${fillPct}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>

                                    <td className={`${styles.td} ${styles.tdCenter}`}>
                                        {isFull ? (
                                            <span className={`${styles.joinBtn} ${styles.joinBtnFull}`}>Full</span>
                                        ) : (
                                            <button className={styles.joinBtn} onClick={() => navigate(`/table/${game.gameId}`)}>
                                                Join
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {games.length > PAGE_SIZE && (
                <div className={styles.footer}>
                    <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, games.length)} of {games.length}</span>
                    <div className={styles.pageControls}>
                        <button className={styles.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</button>
                        <span>{page} / {totalPages}</span>
                        <button className={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>→</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TableList;
