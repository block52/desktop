import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import CopyButton from "../../components/copyButton/CopyButton";
import { usePlayersDirectory } from "../../hooks/usePlayersDirectory";
import { formatMicroUsd } from "../../utils/currency";
import type { PlayerSortField } from "../../utils/indexer";
import styles from "./Players.module.css";

const PAGE_SIZE = 20;

export function playerInitials(address: string): string {
    // Skip the shared "b521" prefix so initials differ between players.
    return address.slice(4, 6).toUpperCase();
}

const Players: React.FC = () => {
    const navigate = useNavigate();
    const [draft, setDraft] = useState("");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<PlayerSortField>("net_profit");
    const [order, setOrder] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(0);

    const { players, total, isLoading, error } = usePlayersDirectory({
        search,
        sort,
        order,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE
    });

    const applySearch = (value: string) => {
        setSearch(value.trim());
        setPage(0);
    };

    const toggleSort = (field: PlayerSortField) => {
        if (sort === field) {
            setOrder(o => (o === "asc" ? "desc" : "asc"));
        } else {
            setSort(field);
            setOrder("desc");
        }
        setPage(0);
    };

    const arrow = (field: PlayerSortField) => (sort === field ? (order === "asc" ? " ↑" : " ↓") : "");
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.headerText}>
                    <h1 className={styles.title}>Players</h1>
                    <p className={styles.subtitle}>
                        Ranked by {sort === "net_profit" ? "net result" : sort.replace(/_/g, " ")}. All figures from chain via the indexer.
                    </p>
                </div>
                <div className={styles.searchRow}>
                    <input
                        className={styles.searchInput}
                        value={draft}
                        placeholder="Search players by address"
                        onChange={e => {
                            setDraft(e.target.value);
                            if (e.target.value.trim() === "") applySearch("");
                        }}
                        onKeyDown={e => {
                            if (e.key === "Enter") applySearch(draft);
                        }}
                    />
                    <button type="button" className={`btn-ghost ${styles.pill}`} onClick={() => applySearch(draft)}>
                        Search
                    </button>
                </div>
            </div>

            <div className={`pane-lite ${styles.panel}`}>
                <div className={`${styles.grid} ${styles.headRow}`}>
                    <span className="section-label">#</span>
                    <span className="section-label">Player{total > 0 ? ` · ${total.toLocaleString()}` : ""}</span>
                    <button type="button" className={`section-label ${styles.sortButton}`} onClick={() => toggleSort("total_hands")}>
                        Hands{arrow("total_hands")}
                    </button>
                    <button
                        type="button"
                        className={`section-label ${styles.sortButton} ${styles.hideNarrow}`}
                        onClick={() => toggleSort("total_rake_contributed")}
                    >
                        Rake{arrow("total_rake_contributed")}
                    </button>
                    <button type="button" className={`section-label ${styles.sortButton}`} onClick={() => toggleSort("net_profit")}>
                        Net{arrow("net_profit")}
                    </button>
                </div>

                {isLoading && <p className={styles.state}>Loading players…</p>}
                {!isLoading && error !== "" && <p className={`${styles.state} ${styles.stateError}`}>{error}</p>}
                {!isLoading && error === "" && players.length === 0 && (
                    <p className={styles.state}>{search === "" ? "No players yet." : "No players match that address."}</p>
                )}

                {!isLoading &&
                    players.map((player, index) => {
                        const rank = page * PAGE_SIZE + index + 1;
                        return (
                            <div
                                key={player.player_address}
                                className={`row-hover ${styles.grid} ${styles.row}`}
                                onClick={() => navigate(`/players/${player.player_address}`)}
                            >
                                <span className={`${styles.rank} ${rank <= 3 ? styles.rankGold : ""}`}>{rank}</span>
                                <div className={styles.who}>
                                    <div className={styles.avatar}>{playerInitials(player.player_address)}</div>
                                    <div className={styles.whoText}>
                                        <span className={styles.addrLine}>
                                            <span className={styles.addr}>{`${player.player_address.slice(0, 10)}…${player.player_address.slice(-6)}`}</span>
                                            <span onClick={e => e.stopPropagation()}>
                                                <CopyButton text={player.player_address} message="Address copied" title="Copy address" />
                                            </span>
                                        </span>
                                        <span className={styles.tier}>{player.vip_tier}</span>
                                    </div>
                                </div>
                                <span className={styles.num}>{player.total_hands.toLocaleString()}</span>
                                <span className={`${styles.num} ${styles.hideNarrow}`}>{formatMicroUsd(player.total_rake_contributed)}</span>
                                <span className={`${styles.net} ${player.net_profit >= 0 ? styles.pos : styles.neg}`}>
                                    {player.net_profit > 0 ? "+" : ""}
                                    {formatMicroUsd(player.net_profit)}
                                </span>
                            </div>
                        );
                    })}

                {total > PAGE_SIZE && (
                    <div className={styles.footer}>
                        <button type="button" className={`btn-ghost ${styles.pill}`} disabled={page === 0 || isLoading} onClick={() => setPage(p => p - 1)}>
                            Previous
                        </button>
                        <span>
                            Page {page + 1} of {pageCount}
                        </span>
                        <button
                            type="button"
                            className={`btn-ghost ${styles.pill}`}
                            disabled={page + 1 >= pageCount || isLoading}
                            onClick={() => setPage(p => p + 1)}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Players;
