import React, { useState } from "react";
import { GameFormat, isTournamentFormat } from "@block52/poker-vm-sdk";
import { useHandReplay } from "../../hooks/useHandReplay";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { getCosmosAddress } from "../../utils/cosmos/storage";
import { microToDecimal } from "../../utils/currency";
import { buildReplaySteps } from "../../utils/handReplay";
import { ACTION_VERBS } from "../../components/table/HandLog";
import { shortAddress } from "../../components/table/shortAddress";
import PlayingCard, { parseCard } from "../../components/table/PlayingCard";
import styles from "./HandHistory.module.css";

const BOARD_SIZE = 5;
// Public web replay of the same hand (the desktop app has no hosted URL of its own).
const WEB_APP_ORIGIN = "https://app.block52.xyz";

interface HandReplayProps {
    gameId: string;
    handNumber: number;
}

const HandReplay: React.FC<HandReplayProps> = ({ gameId, handNumber }) => {
    const { snapshot, deckSeed, isLoading, error } = useHandReplay(gameId, handNumber);
    const copy = useCopyToClipboard();
    const [stepIndex, setStepIndex] = useState<number | null>(null);
    const localAddress = getCosmosAddress();

    if (isLoading) return <p className={styles.state}>Loading hand #{handNumber}…</p>;
    if (error !== "") return <p className={`${styles.state} ${styles.stateError}`}>{error}</p>;
    if (snapshot === null) return null;

    const { state, format } = snapshot;
    const isChips = format !== undefined && (format === GameFormat.SIT_AND_GO || isTournamentFormat(format as GameFormat));
    const formatAmount = (micro: string): string => {
        if (!/^\d+$/.test(micro)) return micro;
        return isChips ? BigInt(micro).toLocaleString() : `$${microToDecimal(BigInt(micro))}`;
    };

    const steps = buildReplaySteps(state);
    const current = Math.min(stepIndex ?? steps.length - 1, steps.length - 1);
    const step = steps[current];
    const isFinal = current === steps.length - 1;

    const actorLabel = (playerId: string): string =>
        localAddress !== null && playerId.toLowerCase() === localAddress.toLowerCase() ? "You" : shortAddress(playerId);

    const stepText = (): string => {
        if (step.action === null) return step.street === "Start" ? "Hand starts" : "Showdown";
        const verb = ACTION_VERBS[step.action.action] ?? step.action.action.replace(/-/g, " ");
        const hasAmount = step.action.amount !== "" && step.action.amount !== "0";
        return `${actorLabel(step.action.playerId)} ${verb}${hasAmount ? ` ${formatAmount(step.action.amount)}` : ""}`;
    };

    // Hole cards the chain has unmasked (yours, plus anyone who showed).
    const revealed = state.players
        .map(player => ({
            player,
            cards: (player.holeCards ?? []).filter(code => parseCard(code) !== null)
        }))
        .filter(entry => entry.cards.length > 0);

    return (
        <div className={styles.replay}>
            <div className={styles.replayHead}>
                <div className={styles.replayTitle}>
                    <span className={styles.replayName}>Hand #{handNumber}</span>
                    <span className={styles.mono}>{gameId}</span>
                </div>
                <button
                    type="button"
                    className={`btn-ghost ${styles.pill}`}
                    onClick={() => void copy(`${WEB_APP_ORIGIN}/table/${gameId}?hand=${handNumber}`, "Replay link copied")}
                >
                    Copy link
                </button>
            </div>

            <div className={styles.felt}>
                {isFinal && <span className={styles.pot}>Pot {formatAmount(state.totalPot)}</span>}
                <div className={styles.board}>
                    {Array.from({ length: BOARD_SIZE }, (_, i) => {
                        const code = step.board[i];
                        return code === undefined ? (
                            <div key={i} className={styles.emptyCard} />
                        ) : (
                            <PlayingCard key={i} code={code} className={styles.boardCard} />
                        );
                    })}
                </div>
                {isFinal && revealed.length > 0 && (
                    <div className={styles.hands}>
                        {revealed.map(({ player, cards }) => (
                            <div key={player.address} className={styles.handGroup}>
                                <div className={styles.holeCards}>
                                    {cards.map((code, i) => (
                                        <PlayingCard key={i} code={code} className={styles.holeCard} />
                                    ))}
                                </div>
                                <span className={styles.handLabel}>{actorLabel(player.address)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className={styles.stepper}>
                <button type="button" className={`btn-ghost ${styles.pill}`} disabled={current === 0} onClick={() => setStepIndex(current - 1)}>
                    ‹ Prev
                </button>
                <div className={styles.dots}>
                    {steps.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            aria-label={`Step ${i + 1}`}
                            className={`${styles.dot} ${i === current ? styles.dotActive : i < current ? styles.dotDone : ""}`}
                            onClick={() => setStepIndex(i)}
                        />
                    ))}
                </div>
                <button
                    type="button"
                    className={`btn-ghost ${styles.pill}`}
                    disabled={current === steps.length - 1}
                    onClick={() => setStepIndex(current + 1)}
                >
                    Next ›
                </button>
            </div>

            <div className={styles.stepInfo}>
                <span className="section-label">{step.street}</span>
                <span className={styles.stepText}>{stepText()}</span>
                <span className={styles.stepPos}>
                    {current + 1} / {steps.length}
                </span>
            </div>

            {isFinal && state.winners.length > 0 && (
                <div className={styles.winners}>
                    <span className="section-label">Winners</span>
                    {state.winners.map((winner, i) => (
                        <span key={i}>
                            {actorLabel(winner.address)} won {formatAmount(winner.amount)}
                            {winner.description !== undefined && winner.description !== "" ? ` · ${winner.description}` : ""}
                        </span>
                    ))}
                </div>
            )}

            <div className={styles.footer}>
                <span>{isChips ? "Chips" : "USDC"} table</span>
                {deckSeed !== null && <span className={styles.mono}>seed {deckSeed.slice(0, 10)}…{deckSeed.slice(-6)}</span>}
            </div>
        </div>
    );
};

export default HandReplay;
