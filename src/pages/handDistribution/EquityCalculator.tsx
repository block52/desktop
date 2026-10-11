import React, { useCallback, useState } from "react";
import type { EquityResponse } from "@block52/poker-vm-sdk";
import { useNetwork } from "../../context/NetworkContext";
import { getCosmosClient } from "../../utils/cosmos/client";
import styles from "./HandDistribution.module.css";

const DEFAULT_SIMULATIONS = "10000";
const MAX_HANDS = 9;

const CARD_PATTERN = /^(A|K|Q|J|T|10|[2-9])[CDHS]$/i;

function parseCards(raw: string): string[] {
    return raw
        .trim()
        .split(/\s+/)
        .filter(token => token !== "")
        .map(token => token.toUpperCase());
}

function validateCards(cards: string[]): string | null {
    for (const card of cards) {
        if (!CARD_PATTERN.test(card)) {
            return `"${card}" is not a valid card — use rank + suit, e.g. As, Kh, 10d`;
        }
    }
    return null;
}

const EquityCalculator: React.FC = () => {
    const { currentNetwork } = useNetwork();

    const [hands, setHands] = useState<string[]>(["", ""]);
    const [board, setBoard] = useState("");
    const [simulations, setSimulations] = useState(DEFAULT_SIMULATIONS);
    const [result, setResult] = useState<EquityResponse | null>(null);
    const [error, setError] = useState("");
    const [isCalculating, setIsCalculating] = useState(false);

    const setHand = (index: number, value: string) => {
        setHands(prev => prev.map((h, i) => (i === index ? value : h)));
    };

    const addHand = () => {
        setHands(prev => (prev.length < MAX_HANDS ? [...prev, ""] : prev));
    };

    const removeHand = (index: number) => {
        setHands(prev => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));
    };

    const handleCalculate = useCallback(async () => {
        setError("");
        setResult(null);

        const parsedHands = hands.map(parseCards).filter(cards => cards.length > 0);
        if (parsedHands.length < 2) {
            setError("Enter at least two hands");
            return;
        }
        for (const cards of parsedHands) {
            if (cards.length !== 2) {
                setError("Each hand must have exactly 2 cards");
                return;
            }
            const invalid = validateCards(cards);
            if (invalid) {
                setError(invalid);
                return;
            }
        }

        const boardCards = parseCards(board);
        if (![0, 3, 4, 5].includes(boardCards.length)) {
            setError("Board must have 0, 3, 4, or 5 cards");
            return;
        }
        const invalidBoard = validateCards(boardCards);
        if (invalidBoard) {
            setError(invalidBoard);
            return;
        }

        const allCards = [...parsedHands.flat(), ...boardCards];
        if (new Set(allCards).size !== allCards.length) {
            setError("Duplicate cards across hands and board");
            return;
        }

        const sims = parseInt(simulations, 10);
        if (!Number.isInteger(sims) || sims < 100 || sims > 1000000) {
            setError("Simulations must be between 100 and 1,000,000");
            return;
        }

        setIsCalculating(true);
        try {
            const client = getCosmosClient(currentNetwork);
            if (!client) throw new Error("Block52 client not initialized");
            const response = await client.calculateEquityFull(parsedHands, boardCards, [], sims);
            setResult(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Equity calculation failed");
        } finally {
            setIsCalculating(false);
        }
    }, [hands, board, simulations, currentNetwork]);

    return (
        <div className={styles.page}>
            <div className={`pane-lite ${styles.formCard}`}>
                <span className="section-label">Equity calculator</span>

                {hands.map((hand, index) => (
                    <div key={index} className={styles.handRow}>
                        <div className={styles.field}>
                            <label className={styles.label}>Player {index + 1}</label>
                            <input
                                type="text"
                                value={hand}
                                onChange={e => setHand(index, e.target.value)}
                                placeholder="e.g. As Kh"
                                className={styles.input}
                            />
                        </div>
                        {hands.length > 2 && (
                            <button
                                className={styles.removeButton}
                                onClick={() => removeHand(index)}
                                title={`Remove player ${index + 1}`}
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <path d="M18 6 6 18" />
                                    <path d="m6 6 12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                ))}

                <div>
                    <button
                        className={`btn-ghost ${styles.ghostButton}`}
                        onClick={addHand}
                        disabled={hands.length >= MAX_HANDS}
                    >
                        + Add player
                    </button>
                </div>

                <div className={styles.fieldRow}>
                    <div className={styles.field}>
                        <label className={styles.label}>Board (optional)</label>
                        <input
                            type="text"
                            value={board}
                            onChange={e => setBoard(e.target.value)}
                            placeholder="e.g. Ah 7c 2d"
                            className={styles.input}
                        />
                    </div>
                    <div className={`${styles.field} ${styles.simsField}`}>
                        <label className={styles.label}>Simulations</label>
                        <input
                            type="number"
                            value={simulations}
                            onChange={e => setSimulations(e.target.value)}
                            min="100"
                            max="1000000"
                            step="100"
                            className={styles.input}
                        />
                    </div>
                </div>

                {error && <p className={styles.formError}>{error}</p>}

                <div>
                    <button
                        className={`btn-glow ${styles.primaryButton}`}
                        onClick={() => void handleCalculate()}
                        disabled={isCalculating}
                    >
                        {isCalculating ? "Calculating…" : "Calculate equity"}
                    </button>
                </div>
            </div>

            {result && (
                <div className={`pane-lite ${styles.panel}`}>
                    <div className={styles.panelHeader}>
                        <span className="section-label">Results — {result.stage}</span>
                        <span className={styles.monoMuted}>
                            {Number(result.simulations).toLocaleString()} sims · {result.duration_ms}ms ·{" "}
                            {Number(result.hands_per_sec).toLocaleString()} hands/s
                        </span>
                    </div>
                    {result.results.map(hand => {
                        const winPct = Number(hand.equity) * 100;
                        const tiePct = Number(hand.tie_equity) * 100;
                        return (
                            <div key={hand.hand_index} className={styles.resultRow}>
                                <span className={styles.resultHand}>{hand.hand.join(" ")}</span>
                                <div className={styles.barWrap}>
                                    <div className={styles.barTrack}>
                                        <div className={styles.barFill} style={{ width: `${winPct}%` }} />
                                    </div>
                                    <span className={styles.barLabel}>
                                        {winPct.toFixed(1)}%{tiePct > 0 ? ` (+${tiePct.toFixed(1)}% tie)` : ""}
                                    </span>
                                </div>
                                <span className={styles.monoMuted}>
                                    {hand.wins.toLocaleString()}W · {hand.ties.toLocaleString()}T ·{" "}
                                    {hand.losses.toLocaleString()}L
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default EquityCalculator;
