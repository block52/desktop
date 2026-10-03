import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PlayerActionType, NonPlayerActionType, hasAction, isSitAndGoFormat } from "@block52/poker-vm-sdk";
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
import { getCosmosAddress } from "../../utils/cosmos/storage";
import type { PlayerActionResult, JoinTableResult, LeaveTableResult } from "../../types";
import { TableHeader } from "../../components/table/TableHeader";
import { TableBoard } from "../../components/table/TableBoard";
import { TableSidebar } from "../../components/table/TableSidebar";
import { PlayerActionButtons } from "../../components/table/PlayerActionButtons";
import { NoWalletOverlay } from "../../components/table/NoWalletOverlay";
import { TableErrorPage } from "../../components/table/TableErrorPage";
import styles from "./Table.module.css";

function formatMicro(value: string): string {
    return (Number(value) / 1_000_000).toFixed(3);
}

const Table: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const tableId = id ?? "";
    const { currentNetwork } = useNetwork();
    const { gameState, gameFormat, isLoading, error, validationError, subscribeToTable, unsubscribeFromTable, getLatestSnapshot } =
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

    const hasWallet = !!getCosmosAddress();
    const localAddress = getCosmosAddress()?.toLowerCase() ?? null;

    if (error) {
        return (
            <div className={styles.page}>
                <TableErrorPage message={error.message} onRetry={() => id && subscribeToTable(id)} />
            </div>
        );
    }

    if (isLoading || !gameState) {
        return (
            <div className={styles.page}>
                <div className={styles.connecting}>Connecting…</div>
            </div>
        );
    }

    const isUserSeated = gameState.players.some(p => p.address.toLowerCase() === localAddress);
    const hasEmptySeats = gameState.players.length < gameState.gameOptions.maxPlayers;
    const sitAndGoWaiting =
        isSitAndGoFormat(gameFormat) && isUserSeated && hasEmptySeats
            ? {
                  prizePool: formatMicro(gameState.totalPot),
                  seated: gameState.players.length,
                  maxPlayers: gameState.gameOptions.maxPlayers,
              }
            : undefined;

    const content = (
        <>
            <TableHeader
                tableLabel={`Table ${tableId}`}
                smallBlind={formatMicro(gameState.gameOptions.smallBlind)}
                bigBlind={formatMicro(gameState.gameOptions.bigBlind)}
                handNumber={gameState.handNumber}
                round={gameState.round}
                playerCount={gameState.players.length}
                maxPlayers={gameState.gameOptions.maxPlayers}
                onLeave={() => runAction("Leave", () => leaveTable(tableId, currentNetwork))}
                leaveDisabled={isSubmitting}
            />
            {validationError && <div className={styles.validationError}>Validation: {validationError.message}</div>}
            {isDealingNewHand && <div className={styles.autoIndicator}>Dealing next hand…</div>}
            {actionStatus && <div className={styles.autoIndicator}>{actionStatus}</div>}
            {actionError && <div className={styles.validationError}>{actionError}</div>}
            <div className={styles.boardRow}>
                <TableBoard
                    players={gameState.players}
                    maxPlayers={gameState.gameOptions.maxPlayers}
                    localAddress={localAddress}
                    nextToAct={gameState.nextToAct}
                    smallBlindPosition={gameState.smallBlindPosition}
                    bigBlindPosition={gameState.bigBlindPosition}
                    dealer={gameState.dealer}
                    formatStack={formatMicro}
                    communityCards={gameState.communityCards}
                    pot={formatMicro(gameState.totalPot)}
                    round={gameState.round}
                    sitAndGoWaiting={sitAndGoWaiting}
                    waitingForPlayers={
                        hasEmptySeats && gameState.players.length < gameState.gameOptions.minPlayers
                            ? {
                                  seated: gameState.players.length,
                                  minPlayers: gameState.gameOptions.minPlayers,
                                  maxPlayers: gameState.gameOptions.maxPlayers,
                              }
                            : undefined
                    }
                />
                <TableSidebar legalActions={legalActions.legalActions} isPlayerTurn={legalActions.isPlayerTurn} />
            </div>
            <div className={styles.joinRow}>
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
            </div>
            <PlayerActionButtons
                isSubmitting={isSubmitting}
                betAmount={betAmount}
                onBetAmountChange={setBetAmount}
                callAmount={callAmount}
                onCallAmountChange={setCallAmount}
                raiseAmount={raiseAmount}
                onRaiseAmountChange={setRaiseAmount}
                onBet={() => runAction("Bet", () => betHand(tableId, parseUsdcToMicro(betAmount), currentNetwork))}
                onCall={() => runAction("Call", () => callHand(tableId, parseUsdcToMicro(callAmount), currentNetwork))}
                onRaise={() => runAction("Raise", () => raiseHand(tableId, parseUsdcToMicro(raiseAmount), currentNetwork))}
                onCheck={() => runAction("Check", () => checkHand(tableId, currentNetwork))}
                onFold={() => runAction("Fold", () => foldHand(tableId, currentNetwork))}
                onMuck={() => runAction("Muck", () => muckCards(tableId, currentNetwork))}
                onShow={() => runAction("Show", () => showCards(tableId, currentNetwork))}
                onSitIn={() => runAction("Sit in", () => sitIn(tableId, currentNetwork))}
                onSitInAndWait={() => runAction("Sit in and wait", () => sitInAndWait(tableId, currentNetwork))}
                onSitOut={() => runAction("Sit out", () => sitOut(tableId, currentNetwork))}
                autoStatusNote="Auto: blinds/deal/new-hand fire automatically"
            />
        </>
    );

    return (
        <div className={styles.page}>
            {content}
            {!hasWallet && <NoWalletOverlay onConnect={() => window.location.assign("#/wallet")} />}
        </div>
    );
};

export default Table;
