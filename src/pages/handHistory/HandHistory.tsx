import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMyHands } from "../../hooks/useMyHands";
import { useRecentHands } from "../../hooks/useRecentHands";
import { useGameHands } from "../../hooks/useGameHands";
import { getCosmosAddress } from "../../utils/cosmos/storage";
import { describeHandOutcome } from "../../utils/handOutcome";
import HandReplay from "./HandReplay";
import styles from "./HandHistory.module.css";

type Scope = "mine" | "all" | "table";

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
    // Opened from a table's hand log: start on that table's hands.
    const routerState: unknown = useLocation().state;
    const tableGameId =
        typeof routerState === "object" && routerState !== null && "gameId" in routerState && typeof routerState.gameId === "string"
            ? routerState.gameId
            : null;
    const [scope, setScope] = useState<Scope>(tableGameId !== null ? "table" : address === null ? "all" : "mine");
    const [selection, setSelection] = useState<Selection | null>(null);

    const mine = useMyHands(scope === "mine" ? address : null);
    const recent = useRecentHands(scope === "all");
    const tableHands = useGameHands(scope === "table" ? tableGameId : null);

    // Open the newest hand of the list by default so the replay isn't empty.
    const firstMine = mine.hands.length > 0 ? mine.hands[0] : null;
    const firstRecent = recent.hands.length > 0 ? recent.hands[0] : null;
    const firstTable = tableHands.hands.length > 0 ? tableHands.hands[0] : null;
    useEffect(() => {
        if (selection !== null) return;
        if (scope === "mine" && firstMine !== null) setSelection({ gameId: firstMine.game_id, handNumber: firstMine.hand_number });
        if (scope === "all" && firstRecent !== null) setSelection({ gameId: firstRecent.game_id, handNumber: firstRecent.hand_number });
        if (scope === "table" && firstTable !== null) setSelection({ gameId: firstTable.game_id, handNumber: firstTable.hand_number });
    }, [scope, selection, firstMine, firstRecent, firstTable]);

    const switchScope = (next: Scope) => {
        setScope(next);
        setSelection(null);
    };

    const listed = scope === "table" ? tableHands : recent;

    const isSelected = (gameId: string, handNumber: number) => selection?.gameId === gameId && selection.handNumber === handNumber;

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.headerText}>
                    <h1 className={styles.title}>Hand history</h1>
                    <p className={styles.subtitle}>Replay any hand from chain state. Share the link, verify the deck.</p>
                </div>
                <div className="segmented" role="tablist">
                    {tableGameId !== null && (
                        <button type="button" role="tab" aria-selected={scope === "table"} className={scope === "table" ? "seg on" : "seg"} onClick={() => switchScope("table")}>
                            This table
                        </button>
                    )}
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
                            {mine.estimated && mine.hands.length > 0 && (
                                <p className={styles.state}>
                                    The indexer has not attributed these hands to your wallet yet, so they are the hands of the tables you sat
                                    at while you were seated. Open one to replay it; results show once the indexer links them.
                                </p>
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
                                                {hand.estimated === true ? "" : `Seat ${hand.seat} · `}
                                                {formatWhen(hand.ended_at, hand.block_height)}
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

                    {(scope === "all" || scope === "table") && (
                        <>
                            {listed.isLoading && listed.hands.length === 0 && <p className={styles.state}>Loading hands…</p>}
                            {listed.error !== "" && <p className={`${styles.state} ${styles.stateError}`}>{listed.error}</p>}
                            {!listed.isLoading && listed.error === "" && listed.hands.length === 0 && <p className={styles.state}>No indexed hands yet.</p>}
                            {listed.hands.map(hand => (
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
                            {listed.hasMore && (
                                <button type="button" className={`btn-ghost ${styles.loadMore}`} onClick={listed.loadMore} disabled={listed.isLoading}>
                                    {listed.isLoading ? "Loading…" : "Load more"}
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
