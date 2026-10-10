import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMyHands } from "../../hooks/useMyHands";
import { useRecentHands } from "../../hooks/useRecentHands";
import { getCosmosAddress } from "../../utils/cosmos/storage";
import { describeHandOutcome } from "../../utils/handOutcome";
import HandReplay from "./HandReplay";
import styles from "./HandHistory.module.css";

type Scope = "mine" | "all";

interface Selection {
    gameId: string;
    handNumber: number;
}

function shortId(id: string): string {
    return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

function formatWhen(iso: string | undefined, fallbackBlock: number): string {
    return iso === undefined ? `block ${fallbackBlock.toLocaleString()}` : new Date(iso).toLocaleString();
}

const HandHistory: React.FC = () => {
    const address = getCosmosAddress();
    const [scope, setScope] = useState<Scope>(address === null ? "all" : "mine");
    const [selection, setSelection] = useState<Selection | null>(null);

    const mine = useMyHands(scope === "mine" ? address : null);
    const recent = useRecentHands(scope === "all");

    // Open the newest hand of the list by default so the replay isn't empty.
    const firstMine = mine.hands.length > 0 ? mine.hands[0] : null;
    const firstRecent = recent.hands.length > 0 ? recent.hands[0] : null;
    useEffect(() => {
        if (selection !== null) return;
        if (scope === "mine" && firstMine !== null) setSelection({ gameId: firstMine.game_id, handNumber: firstMine.hand_number });
        if (scope === "all" && firstRecent !== null) setSelection({ gameId: firstRecent.game_id, handNumber: firstRecent.hand_number });
    }, [scope, selection, firstMine, firstRecent]);

    const switchScope = (next: Scope) => {
        setScope(next);
        setSelection(null);
    };

    const isSelected = (gameId: string, handNumber: number) => selection?.gameId === gameId && selection.handNumber === handNumber;

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.headerText}>
                    <h1 className={styles.title}>Hand history</h1>
                    <p className={styles.subtitle}>Replay any hand from chain state. Share the link, verify the deck.</p>
                </div>
                <div className="segmented" role="tablist">
                    <button type="button" role="tab" aria-selected={scope === "mine"} className={scope === "mine" ? "seg on" : "seg"} onClick={() => switchScope("mine")}>
                        My hands
                    </button>
                    <button type="button" role="tab" aria-selected={scope === "all"} className={scope === "all" ? "seg on" : "seg"} onClick={() => switchScope("all")}>
                        All tables
                    </button>
                </div>
            </div>

            <div className={styles.layout}>
                <div className={`pane-lite ${styles.listPanel}`}>
                    {scope === "mine" && address === null && (
                        <p className={styles.state}>
                            No Block52 wallet on this device. <Link to="/wallet">Create or import one</Link> to see your hands.
                        </p>
                    )}

                    {scope === "mine" && address !== null && (
                        <>
                            {mine.isLoading && mine.hands.length === 0 && <p className={styles.state}>Loading your hands…</p>}
                            {mine.error !== "" && <p className={`${styles.state} ${styles.stateError}`}>{mine.error}</p>}
                            {!mine.isLoading && mine.error === "" && mine.hands.length === 0 && (
                                <p className={styles.state}>No indexed hands for this wallet yet.</p>
                            )}
                            {mine.hands.map(hand => {
                                const outcome = describeHandOutcome(hand, mine.chipTables.get(hand.game_id));
                                return (
                                    <div
                                        key={`${hand.game_id}#${hand.hand_number}`}
                                        className={`row-hover ${styles.handRow} ${isSelected(hand.game_id, hand.hand_number) ? styles.handRowSelected : ""}`}
                                        onClick={() => setSelection({ gameId: hand.game_id, handNumber: hand.hand_number })}
                                    >
                                        <div className={styles.handText}>
                                            <span className={styles.handTitle}>
                                                Hand #{hand.hand_number} · {shortId(hand.game_id)}
                                            </span>
                                            <span className={styles.handMeta}>
                                                Seat {hand.seat} · {formatWhen(hand.ended_at, hand.block_height)}
                                            </span>
                                        </div>
                                        <span className={`${styles.amount} ${outcome.tone === "won" ? styles.won : outcome.tone === "lost" ? styles.lost : ""}`}>
                                            {outcome.label}
                                        </span>
                                    </div>
                                );
                            })}
                            {mine.hasMore && (
                                <button type="button" className={`btn-ghost ${styles.loadMore}`} onClick={mine.loadMore} disabled={mine.isLoading}>
                                    {mine.isLoading ? "Loading…" : "Load more"}
                                </button>
                            )}
                        </>
                    )}

                    {scope === "all" && (
                        <>
                            {recent.isLoading && recent.hands.length === 0 && <p className={styles.state}>Loading hands…</p>}
                            {recent.error !== "" && <p className={`${styles.state} ${styles.stateError}`}>{recent.error}</p>}
                            {!recent.isLoading && recent.error === "" && recent.hands.length === 0 && <p className={styles.state}>No indexed hands yet.</p>}
                            {recent.hands.map(hand => (
                                <div
                                    key={`${hand.game_id}#${hand.hand_number}`}
                                    className={`row-hover ${styles.handRow} ${isSelected(hand.game_id, hand.hand_number) ? styles.handRowSelected : ""}`}
                                    onClick={() => setSelection({ gameId: hand.game_id, handNumber: hand.hand_number })}
                                >
                                    <div className={styles.handText}>
                                        <span className={styles.handTitle}>
                                            Hand #{hand.hand_number} · {shortId(hand.game_id)}
                                        </span>
                                        <span className={styles.handMeta}>{formatWhen(hand.created_at, hand.block_height)}</span>
                                    </div>
                                    <span className={styles.handMeta}>#{hand.block_height.toLocaleString()}</span>
                                </div>
                            ))}
                            {recent.hasMore && (
                                <button type="button" className={`btn-ghost ${styles.loadMore}`} onClick={recent.loadMore} disabled={recent.isLoading}>
                                    {recent.isLoading ? "Loading…" : "Load more"}
                                </button>
                            )}
                        </>
                    )}
                </div>

                <div className={"pane-lite"}>
                    {selection === null ? (
                        <p className={styles.state}>Pick a hand to replay it.</p>
                    ) : (
                        <HandReplay key={`${selection.gameId}#${selection.handNumber}`} gameId={selection.gameId} handNumber={selection.handNumber} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default HandHistory;
