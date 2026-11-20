import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CopyButton } from "@block52/ui-sdk";
import { usePlayersDirectory } from "../../hooks/usePlayersDirectory";
import { usePlayerNotes } from "../../hooks/usePlayerNotes";
import { formatMicroUsd } from "../../utils/currency";
import type { PlayerListItem, PlayerSortField } from "../../utils/indexer";
import type { Tag } from "../../players/types";
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

    // The indexer only knows addresses, so a nickname/tag query returns nothing
    // from it. Resolve those locally and fold the matches in, so searching by a
    // note or tag finds the player even when they have no indexer stats.
    const [localMatches, setLocalMatches] = useState<string[]>([]);
    useEffect(() => {
        let cancelled = false;
        if (search === "") {
            setLocalMatches([]);
            return;
        }
        window.electronAPI?.players
            ?.search(search)
            .then(addresses => {
                if (!cancelled) setLocalMatches(addresses);
            })
            .catch(() => {
                if (!cancelled) setLocalMatches([]);
            });
        return () => {
            cancelled = true;
        };
    }, [search]);

    // Local-only matches (nickname/tag hits the indexer has no row for) rendered
    // with zeroed stats; the profile page still loads their real figures.
    const merged = useMemo<PlayerListItem[]>(() => {
        if (localMatches.length === 0) return players;
        const known = new Set(players.map(p => p.player_address));
        const extras: PlayerListItem[] = localMatches
            .filter(address => !known.has(address))
            .map(address => ({
                player_address: address,
                vip_tier: "",
                rakeback_pct: 0,
                total_hands: 0,
                total_actions: 0,
                net_profit: 0,
                total_rake_contributed: 0
            }));
        return [...players, ...extras];
    }, [players, localMatches]);

    // Local, private notes for the players on this page (nickname + tags).
    const { notes } = usePlayerNotes(merged.map(p => p.player_address));

    // All tags the user has, for the filter chips next to the search.
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [tagFilter, setTagFilter] = useState<number | null>(null);
    useEffect(() => {
        window.electronAPI?.players?.listTags().then(setAllTags).catch(() => setAllTags([]));
    }, [notes]);

    // The tag filter narrows the loaded page to players carrying that tag.
    const shown = useMemo(
        () => (tagFilter === null ? merged : merged.filter(p => (notes[p.player_address]?.tags ?? []).some(t => t.id === tagFilter))),
        [merged, notes, tagFilter]
    );

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
                        placeholder="Search by address, nickname or tag"
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

            {allTags.length > 0 && (
                <div className={styles.tagFilter}>
                    <button
                        type="button"
                        className={`${styles.tagChip} ${tagFilter === null ? styles.tagChipOn : ""}`}
                        onClick={() => setTagFilter(null)}
                    >
                        All
                    </button>
                    {allTags.map(tag => (
                        <button
                            key={tag.id}
                            type="button"
                            className={`${styles.tagChip} ${tagFilter === tag.id ? styles.tagChipOn : ""}`}
                            onClick={() => setTagFilter(id => (id === tag.id ? null : tag.id))}
                        >
                            {tag.name}
                        </button>
                    ))}
                </div>
            )}

            <div className={`pane-lite ${styles.panel}`}>
                <div className={`${styles.grid} ${styles.headRow}`}>
                    <span className="section-label">#</span>
                    <span className="section-label">Player{total > 0 ? ` · ${total.toLocaleString()}` : ""}</span>
                    <button type="button" className={`section-label ${styles.sortButton}`} onClick={() => toggleSort("total_hands")}>
                        Hands{arrow("total_hands")}
                    </button>
                    <button type="button" className={`section-label ${styles.sortButton}`} onClick={() => toggleSort("net_profit")}>
                        Net{arrow("net_profit")}
                    </button>
                </div>

                {isLoading && <p className={styles.state}>Loading players…</p>}
                {!isLoading && error !== "" && merged.length === 0 && <p className={`${styles.state} ${styles.stateError}`}>{error}</p>}
                {!isLoading && error === "" && merged.length === 0 && (
                    <p className={styles.state}>{search === "" ? "No players yet." : "No players match that search."}</p>
                )}

                {!isLoading && shown.length === 0 && tagFilter !== null && merged.length > 0 && (
                    <p className={styles.state}>No players on this page have that tag.</p>
                )}

                {!isLoading &&
                    shown.map((player, index) => {
                        const rank = page * PAGE_SIZE + index + 1;
                        const note = notes[player.player_address];
                        return (
                            <div
                                key={player.player_address}
                                className={`row-hover ${styles.grid} ${styles.row}`}
                                onClick={() => navigate(`/players/${player.player_address}`)}
                            >
                                <span className={styles.rank}>{rank}</span>
                                <div className={styles.who}>
                                    <div className={styles.avatar}>{playerInitials(player.player_address)}</div>
                                    <div className={styles.whoText}>
                                        {note?.nickname != null && note.nickname !== "" && <span className={styles.nickname}>{note.nickname}</span>}
                                        <span className={styles.addrLine}>
                                            <span className={styles.addr}>{player.player_address}</span>
                                            <span onClick={e => e.stopPropagation()}>
                                                <CopyButton text={player.player_address} message="Address copied" title="Copy address" />
                                            </span>
                                        </span>
                                        {note !== undefined && note.tags.length > 0 && (
                                            <span className={styles.rowTags}>
                                                {note.tags.map(tag => (
                                                    <span key={tag.id} className={styles.rowTag}>{tag.name}</span>
                                                ))}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className={styles.num}>{player.total_hands.toLocaleString()}</span>
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
