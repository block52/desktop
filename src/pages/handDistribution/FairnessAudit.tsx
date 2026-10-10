import React from "react";
import { useDistributionStats } from "../../hooks/useDistributionStats";
import { SUIT_LABELS, orderCardStats, presentResult, type ChiSquaredResult } from "../../utils/indexer";
import styles from "./FairnessAudit.module.css";

const TONE_CLASS = { ok: styles.toneOk, warn: styles.toneWarn, bad: styles.toneBad, mute: styles.toneMute } as const;

function formatPValue(p: number): string {
    return p < 0.0001 ? "<0.0001" : p.toFixed(4);
}

const TestRow: React.FC<{ label: string; test: ChiSquaredResult }> = ({ label, test }) => {
    const shown = presentResult(test.result);
    const hasData = test.result !== "NO_DATA";
    return (
        <div className={styles.testRow}>
            <div className={styles.testHead}>
                <span className={styles.testLabel}>{label}</span>
                <span className={`${styles.badge} ${TONE_CLASS[shown.tone]}`}>{test.result === "NO_DATA" ? "NO DATA" : test.result}</span>
            </div>
            <span className={styles.testStats}>
                {hasData
                    ? `χ² ${test.chi_squared.toFixed(1)} · p ${formatPValue(test.p_value)} · ${test.degrees_of_freedom} df`
                    : `${test.degrees_of_freedom} df`}
            </span>
            <span className={styles.testNote}>{test.interpretation}</span>
        </div>
    );
};

const FairnessAudit: React.FC = () => {
    const { cards, summary, randomness, status, isLoading, error, reload } = useDistributionStats();

    if (isLoading) {
        return <div className={styles.state}>Loading distribution data…</div>;
    }

    if (error !== null) {
        return (
            <div className={`pane-lite ${styles.state}`}>
                <span className={styles.errorText}>{error}</span>
                <button type="button" className={`btn-ghost ${styles.retry}`} onClick={reload}>
                    Retry
                </button>
            </div>
        );
    }

    const ordered = orderCardStats(cards);
    const totalDealt = ordered.reduce((sum, c) => sum + c.total_appearances, 0);
    const expected = ordered.length > 0 ? totalDealt / ordered.length : 0;
    const hasData = totalDealt > 0;
    const cardTest = randomness?.card_chi_squared;
    const verdict = cardTest !== undefined ? presentResult(cardTest.result) : presentResult("NO_DATA");
    const handCount = summary?.total_hands ?? status?.total_hands;

    return (
        <>
            <div className={styles.tiles}>
                <div className={`pane-lite ${styles.tile} ${verdict.tone === "ok" ? styles.tileOk : ""}`}>
                    <span className="section-label">Verdict</span>
                    <span className={`${styles.verdict} ${TONE_CLASS[verdict.tone]}`}>{verdict.label}</span>
                </div>
                <div className={`pane-lite ${styles.tile}`}>
                    <span className="section-label">Chi-squared</span>
                    <span className={styles.big}>{cardTest !== undefined && hasData ? cardTest.chi_squared.toFixed(1) : "—"}</span>
                </div>
                <div className={`pane-lite ${styles.tile}`}>
                    <span className="section-label">p-value · {cardTest !== undefined ? cardTest.degrees_of_freedom : 51} df</span>
                    <span className={styles.big}>{cardTest !== undefined && hasData ? formatPValue(cardTest.p_value) : "—"}</span>
                </div>
                <div className={`pane-lite ${styles.tile}`}>
                    <span className="section-label">Cards dealt</span>
                    <span className={styles.big}>{totalDealt.toLocaleString()}</span>
                </div>
            </div>

            <div className={`pane-lite ${styles.chartCard}`}>
                <div className={styles.chartHead}>
                    <span className={styles.chartTitle}>Frequency by card</span>
                    <span className={styles.legend}>
                        <span className={styles.legendLine} />
                        Expected {hasData ? expected.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
                    </span>
                </div>
                <div className={styles.scroll}>
                    <div className={styles.chart}>
                        <div className={styles.expectedLine} />
                        {ordered.map(c => {
                            const height = hasData && expected > 0 ? Math.min((c.total_appearances / (expected * 2)) * 100, 100) : 0;
                            const suit = c.suit.toLowerCase();
                            return (
                                <div
                                    key={c.card}
                                    className={`${styles.bar} ${suit === "d" || suit === "h" ? styles.barBright : ""}`}
                                    style={{ height: `${height}%` }}
                                    title={`${c.rank} of ${SUIT_LABELS[suit] ?? c.suit} · ${c.total_appearances.toLocaleString()}${
                                        totalDealt > 0 ? ` (${((c.total_appearances / totalDealt) * 100).toFixed(2)}%)` : ""
                                    }`}
                                />
                            );
                        })}
                        {!hasData && (
                            <div className={styles.empty}>
                                No revealed cards yet
                                {handCount !== undefined ? ` — ${handCount.toLocaleString()} hands indexed, none with revealed cards` : ""}.
                            </div>
                        )}
                    </div>
                    <div className={styles.suitRow}>
                        {["c", "d", "h", "s"].map(s => (
                            <span key={s} className="section-label">
                                {SUIT_LABELS[s]}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {randomness !== null && (
                <div className={`pane-lite ${styles.tests}`}>
                    <span className="section-label">Chi-squared tests</span>
                    <div className={styles.testGrid}>
                        <TestRow label="Card" test={randomness.card_chi_squared} />
                        <TestRow label="Suit" test={randomness.suit_chi_squared} />
                        <TestRow label="Rank" test={randomness.rank_chi_squared} />
                    </div>
                    {randomness.duplicate_seeds > 0 && (
                        <span className={styles.testNote}>
                            {randomness.duplicate_seeds.toLocaleString()} hands share a deck seed with another hand.
                        </span>
                    )}
                </div>
            )}

            <div className={styles.footer}>
                {status !== null ? (
                    <>
                        <span>Indexer {status.percent_complete.toFixed(1)}% synced</span>
                        <span>{status.total_hands.toLocaleString()} hands</span>
                        <span>{status.total_games.toLocaleString()} tables</span>
                        <span>Last block #{status.last_block_indexed.toLocaleString()}</span>
                    </>
                ) : (
                    <span>Indexer status unavailable</span>
                )}
                <button type="button" className={styles.refresh} onClick={reload}>
                    Refresh
                </button>
            </div>
        </>
    );
};

export default FairnessAudit;
