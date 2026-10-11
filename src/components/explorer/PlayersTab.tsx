import React, { useState } from "react";
import { usePlayersDirectory } from "../../hooks/usePlayersDirectory";
import { formatMicroUsd } from "../../utils/currency";
import type { PlayerSortField } from "../../utils/indexer";
import CopyButton from "../copyButton/CopyButton";
import Pagination, { PAGE_SIZES } from "../pagination/Pagination";
import { pageInfo } from "../../utils/paginate";
import styles from "./ExplorerTabs.module.css";

function truncate(address: string): string {
    return `${address.slice(0, 12)}…${address.slice(-8)}`;
}

interface PlayersTabProps {
    onOpenPlayer: (address: string) => void;
}

const PlayersTab: React.FC<PlayersTabProps> = ({ onOpenPlayer }) => {
    const [draft, setDraft] = useState("");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<PlayerSortField>("net_profit");
    const [order, setOrder] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);

    const { players, total, isLoading, error, reload } = usePlayersDirectory({
        search,
        sort,
        order,
        limit: pageSize,
        offset: (page - 1) * pageSize
    });

    const applySearch = (value: string) => {
        setSearch(value.trim());
        setPage(1);
    };

    const toggleSort = (field: PlayerSortField) => {
        if (sort === field) {
            setOrder(o => (o === "asc" ? "desc" : "asc"));
        } else {
            setSort(field);
            setOrder("desc");
        }
        setPage(1);
    };

    const arrow = (field: PlayerSortField) => (sort === field ? (order === "asc" ? " ↑" : " ↓") : "");

    return (
        <>
            <div className={styles.toolbar}>
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
                <button type="button" className={`btn-ghost ${styles.pill}`} onClick={reload} disabled={isLoading}>
                    Reload
                </button>
            </div>

            <div className={`pane-lite ${styles.panel}`}>
                <div className={styles.headRow}>
                    <span className={`${styles.headCell} ${styles.headCellStart}`}>Player{total > 0 ? ` · ${total.toLocaleString()}` : ""}</span>
                    <span className={`${styles.headCell} ${styles.numHead}`} onClick={() => toggleSort("total_hands")}>
                        Hands{arrow("total_hands")}
                    </span>
                    <span className={`${styles.headCell} ${styles.numHead}`} onClick={() => toggleSort("net_profit")}>
                        Net{arrow("net_profit")}
                    </span>
                    <span className={`${styles.headCell} ${styles.numHead} ${styles.hideNarrow}`} onClick={() => toggleSort("total_rake_contributed")}>
                        Rake{arrow("total_rake_contributed")}
                    </span>
                </div>

                {isLoading && <p className={styles.state}>Loading players…</p>}
                {!isLoading && error !== "" && <p className={`${styles.state} ${styles.stateError}`}>{error}</p>}
                {!isLoading && error === "" && players.length === 0 && (
                    <p className={styles.state}>{search === "" ? "No players yet." : "No players match that address."}</p>
                )}

                {!isLoading &&
                    players.map(player => (
                        <div
                            key={player.player_address}
                            className={`row-hover ${styles.row} ${styles.rowLink}`}
                            onClick={() => onOpenPlayer(player.player_address)}
                        >
                            <div className={styles.grow}>
                                <span className={styles.addressLine}>
                                    <span className={styles.primary}>{truncate(player.player_address)}</span>
                                    <span onClick={e => e.stopPropagation()}>
                                        <CopyButton text={player.player_address} message="Address copied" title="Copy address" />
                                    </span>
                                </span>
                                <span className={styles.secondary}>{player.vip_tier}</span>
                            </div>
                            <span className={styles.num} style={{ minWidth: 72 }}>{player.total_hands.toLocaleString()}</span>
                            <span className={`${styles.num} ${player.net_profit >= 0 ? styles.won : styles.lost}`} style={{ minWidth: 72 }}>
                                {formatMicroUsd(player.net_profit)}
                            </span>
                            <span className={`${styles.num} ${styles.hideNarrow}`} style={{ minWidth: 72 }}>
                                {formatMicroUsd(player.total_rake_contributed)}
                            </span>
                        </div>
                    ))}

                <Pagination
                    slice={pageInfo(total, page, pageSize)}
                    pageSize={pageSize}
                    disabled={isLoading}
                    onPageChange={setPage}
                    onPageSizeChange={size => {
                        setPageSize(size);
                        setPage(1);
                    }}
                />
            </div>
        </>
    );
};

export default PlayersTab;
