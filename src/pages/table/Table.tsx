import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PlayerActionType, NonPlayerActionType, hasAction } from "@block52/poker-vm-sdk";
import { useGameState } from "../../context/GameStateContext";
import { useNetwork } from "../../context/NetworkContext";
import { usePlayerLegalActions } from "../../hooks/playerActions/usePlayerLegalActions";
import { betHand } from "../../hooks/playerActions/betHand";
import { callHand } from "../../hooks/playerActions/callHand";
import { checkHand } from "../../hooks/playerActions/checkHand";
import { raiseHand } from "../../hooks/playerActions/raiseHand";
import { foldHand } from "../../hooks/playerActions/foldHand";
import { muckCards } from "../../hooks/playerActions/muckCards";
import { showCards } from "../../hooks/playerActions/showCards";
import { sitIn } from "../../hooks/playerActions/sitIn";
import { sitInAndWait } from "../../hooks/playerActions/sitInAndWait";
import { sitOut } from "../../hooks/playerActions/sitOut";
import { joinTable } from "../../hooks/playerActions/joinTable";
import { leaveTable } from "../../hooks/playerActions/leaveTable";
import { useAutoDeal } from "../../hooks/playerActions/useAutoDeal";
import { useAutoPostBlinds } from "../../hooks/playerActions/useAutoPostBlinds";
import { useAutoNewHand } from "../../hooks/playerActions/useAutoNewHand";
import { parseUsdcToMicro } from "../../utils/currency";
import type { PlayerActionResult, JoinTableResult, LeaveTableResult } from "../../types";

const Table: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const tableId = id ?? "";
    const { currentNetwork } = useNetwork();
    const { gameState, isLoading, error, validationError, latestEvents, subscribeToTable, unsubscribeFromTable, getLatestSnapshot } =
        useGameState();
    const legalActions = usePlayerLegalActions();

    const [betAmount, setBetAmount] = useState<string>("");
    const [callAmount, setCallAmount] = useState<string>("");
    const [raiseAmount, setRaiseAmount] = useState<string>("");
    const [buyInAmount, setBuyInAmount] = useState<string>("");
    const [seatNumber, setSeatNumber] = useState<string>("");
    const [actionStatus, setActionStatus] = useState<string>("");
    const [actionError, setActionError] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    useEffect(() => {
        if (!id) {
            return;
        }
        subscribeToTable(id);
        return () => {
            unsubscribeFromTable();
        };
    }, [id, subscribeToTable, unsubscribeFromTable]);

    const runAction = async (label: string, action: () => Promise<PlayerActionResult | JoinTableResult | LeaveTableResult>) => {
        setIsSubmitting(true);
        setActionStatus(`${label}…`);
        setActionError("");
        try {
            const result = await action();
            setActionStatus(`${label} ok: ${result.hash}`);
        } catch (err) {
            setActionError(err instanceof Error ? err.message : String(err));
            setActionStatus("");
        } finally {
            setIsSubmitting(false);
        }
    };

    const smallBlindAmount = gameState ? BigInt(gameState.gameOptions.smallBlind) : 0n;
    const bigBlindAmount = gameState ? BigInt(gameState.gameOptions.bigBlind) : 0n;

    useAutoPostBlinds(
        tableId,
        currentNetwork,
        hasAction(legalActions.legalActions, PlayerActionType.SMALL_BLIND),
        hasAction(legalActions.legalActions, PlayerActionType.BIG_BLIND),
        smallBlindAmount,
        bigBlindAmount,
        legalActions.isPlayerTurn,
        blindType => setActionStatus(`Auto-posting ${blindType} blind…`),
        (blindType, txHash) => setActionStatus(`Auto-posted ${blindType} blind: ${txHash}`),
        err => setActionError(err.message)
    );

    useAutoDeal(
        tableId,
        currentNetwork,
        hasAction(legalActions.legalActions, NonPlayerActionType.DEAL),
        legalActions.isPlayerTurn,
        () => setActionStatus("Auto-dealing…"),
        txHash => setActionStatus(`Auto-dealt: ${txHash}`),
        err => setActionError(err.message)
    );

    const { isDealingNewHand } = useAutoNewHand(
        tableId,
        currentNetwork,
        () => setActionStatus("Auto-starting new hand…"),
        txHash => setActionStatus(`Auto-started new hand: ${txHash}`),
        err => setActionError(err.message)
    );

    return (
        <div style={{ padding: 16, fontFamily: "monospace", color: "#fff" }}>
            <h1>Table {id}</h1>
            {isLoading && <p>Connecting…</p>}
            {error && <p style={{ color: "#ef4444" }}>Error: {error.message}</p>}
            {validationError && <p style={{ color: "#f59e0b" }}>Validation: {validationError.message}</p>}
            {isDealingNewHand && <p style={{ color: "#22d3ee" }}>Dealing next hand…</p>}
            {actionStatus && <p style={{ color: "#22c55e" }}>{actionStatus}</p>}
            {actionError && <p style={{ color: "#ef4444" }}>Action error: {actionError}</p>}

            <h2>Join / Leave</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input placeholder="Buy-in (USDC)" value={buyInAmount} onChange={e => setBuyInAmount(e.target.value)} />
                <input placeholder="Seat (optional)" value={seatNumber} onChange={e => setSeatNumber(e.target.value)} />
                <button
                    disabled={isSubmitting}
                    onClick={() =>
                        runAction("Join", () =>
                            joinTable(
                                tableId,
                                { amount: buyInAmount, seatNumber: seatNumber ? Number(seatNumber) : undefined },
                                currentNetwork,
                                getLatestSnapshot
                            )
                        )
                    }
                >
                    Join
                </button>
                <button disabled={isSubmitting} onClick={() => runAction("Leave", () => leaveTable(tableId, currentNetwork))}>
                    Leave
                </button>
            </div>

            <h2>In-hand actions</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input placeholder="Bet (USDC)" value={betAmount} onChange={e => setBetAmount(e.target.value)} />
                <button disabled={isSubmitting} onClick={() => runAction("Bet", () => betHand(tableId, parseUsdcToMicro(betAmount), currentNetwork))}>
                    Bet
                </button>
                <input placeholder="Call (USDC)" value={callAmount} onChange={e => setCallAmount(e.target.value)} />
                <button
                    disabled={isSubmitting}
                    onClick={() => runAction("Call", () => callHand(tableId, parseUsdcToMicro(callAmount), currentNetwork))}
                >
                    Call
                </button>
                <input placeholder="Raise (USDC)" value={raiseAmount} onChange={e => setRaiseAmount(e.target.value)} />
                <button
                    disabled={isSubmitting}
                    onClick={() => runAction("Raise", () => raiseHand(tableId, parseUsdcToMicro(raiseAmount), currentNetwork))}
                >
                    Raise
                </button>
                <button disabled={isSubmitting} onClick={() => runAction("Check", () => checkHand(tableId, currentNetwork))}>
                    Check
                </button>
                <button disabled={isSubmitting} onClick={() => runAction("Fold", () => foldHand(tableId, currentNetwork))}>
                    Fold
                </button>
                <button disabled={isSubmitting} onClick={() => runAction("Muck", () => muckCards(tableId, currentNetwork))}>
                    Muck
                </button>
                <button disabled={isSubmitting} onClick={() => runAction("Show", () => showCards(tableId, currentNetwork))}>
                    Show
                </button>
            </div>

            <h2>Sit in / out</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button disabled={isSubmitting} onClick={() => runAction("Sit in", () => sitIn(tableId, currentNetwork))}>
                    Sit In
                </button>
                <button disabled={isSubmitting} onClick={() => runAction("Sit in and wait", () => sitInAndWait(tableId, currentNetwork))}>
                    Sit In And Wait
                </button>
                <button disabled={isSubmitting} onClick={() => runAction("Sit out", () => sitOut(tableId, currentNetwork))}>
                    Sit Out
                </button>
            </div>

            <h2>Legal actions</h2>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(legalActions, null, 2)}</pre>

            <h2>Latest events ({latestEvents.length})</h2>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(latestEvents, null, 2)}</pre>
            <h2>Raw game state</h2>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{gameState ? JSON.stringify(gameState, null, 2) : "(no state yet)"}</pre>
        </div>
    );
};

export default Table;
