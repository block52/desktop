import React from "react";
import { Link } from "react-router-dom";
import { useMyHands } from "../../hooks/useMyHands";
import { getCosmosAddress } from "../../utils/cosmos/storage";
import { describeHandOutcome } from "../../utils/handOutcome";
import styles from "./ExplorerTabs.module.css";

function shortId(id: string): string {
    return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

const TONE_CLASS = { won: styles.won, lost: styles.lost, neutral: "" } as const;

const MyHandsTab: React.FC = () => {
    const address = getCosmosAddress();
    const { hands, total, isLoading, error, hasMore, loadMore, reload, chipTables } = useMyHands(address);

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

                {hands.length > 0 && (
                    <div className={styles.footer}>
                        <span className={styles.secondary}>
                            Showing {hands.length.toLocaleString()} of {total.toLocaleString()}
                        </span>
                        {hasMore && (
                            <button type="button" className={`btn-ghost ${styles.pill}`} onClick={loadMore} disabled={isLoading}>
                                {isLoading ? "Loading…" : "Load more"}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

export default MyHandsTab;
