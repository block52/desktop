import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useMyHandsPage } from "../../hooks/useMyHandsPage";
import { getCosmosAddress } from "../../utils/cosmos/storage";
import { describeHandOutcome } from "../../utils/handOutcome";
import Pagination, { PAGE_SIZES } from "../pagination/Pagination";
import { pageInfo } from "../../utils/paginate";
import styles from "./ExplorerTabs.module.css";

function shortId(id: string): string {
    return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

const TONE_CLASS = { won: styles.won, lost: styles.lost, neutral: "" } as const;

const MyHandsTab: React.FC = () => {
    const address = getCosmosAddress();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
    const { hands, total, isLoading, error, reload, chipTables } = useMyHandsPage(address, page, pageSize);

    if (address === null) {
        return (
            <div className={`pane-lite ${styles.panel}`}>
                <p className={styles.state}>
                    No Block52 wallet on this device. <Link to="/wallet">Create or import one</Link> to see the hands you&apos;ve played.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className={styles.toolbar}>
                <span className={styles.secondary}>{total > 0 ? `${total.toLocaleString()} hands` : "Hands your wallet played, newest first"}</span>
                <button type="button" className={`btn-ghost ${styles.pill}`} onClick={reload} disabled={isLoading}>
                    Reload
                </button>
            </div>

            <div className={`pane-lite ${styles.panel}`}>
                {isLoading && hands.length === 0 && <p className={styles.state}>Loading your hands…</p>}
                {error !== "" && <p className={`${styles.state} ${styles.stateError}`}>{error}</p>}
                {!isLoading && error === "" && hands.length === 0 && <p className={styles.state}>No indexed hands for this wallet yet.</p>}

                {hands.map(hand => {
                    const result = describeHandOutcome(hand, chipTables.get(hand.game_id));
                    return (
                        <div key={`${hand.game_id}#${hand.hand_number}`} className={styles.row}>
                            <div className={styles.grow}>
                                <span className={styles.primary}>
                                    Hand #{hand.hand_number} · Seat {hand.seat}
                                </span>
                                <span className={styles.secondary}>
                                    Table {shortId(hand.game_id)} ·{" "}
                                    {hand.ended_at !== undefined ? new Date(hand.ended_at).toLocaleString() : `block ${hand.block_height.toLocaleString()}`}
                                </span>
                            </div>
                            {hand.community_cards.length > 0 && (
                                <span className={`${styles.cards} ${styles.hideNarrow}`}>
                                    {hand.community_cards.map((card, i) => (
                                        <span key={i} className={styles.card}>
                                            {card}
                                        </span>
                                    ))}
                                </span>
                            )}
                            <span className={`${styles.num} ${TONE_CLASS[result.tone]}`}>{result.label}</span>
                            <Link to={`/table/${hand.game_id}`} className="btn-ghost" style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12 }}>
                                Open table
                            </Link>
                        </div>
                    );
                })}

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

export default MyHandsTab;
