import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { COSMOS_CONSTANTS, PlayerActionType, NonPlayerActionType, TexasHoldemRound, GameVariant, hasAction, isSitAndGoFormat } from "@block52/poker-vm-sdk";
import { useGameState } from "../../context/GameStateContext";
import { useToast } from "../../context/ToastContext";
import { useNetwork } from "../../context/NetworkContext";
import { useCosmosWallet } from "../../hooks/useCosmosWallet";
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
import { HandLog } from "../../components/table/HandLog";
import { JoinTableModal } from "../../components/modal/JoinTableModal";
import { SitAndGoJoinModal } from "../../components/modal/SitAndGoJoinModal";
import { PlayerActionButtons } from "../../components/table/PlayerActionButtons";
import { NoWalletOverlay } from "../../components/table/NoWalletOverlay";
import { TableErrorPage } from "../../components/table/TableErrorPage";
import styles from "./Table.module.css";

function formatMicro(value: string): string {
    return (Number(value) / 1_000_000).toFixed(3);
}

function getVariantLabel(variant: string | undefined): string {
    if (variant === String(GameVariant.OMAHA)) return "PLO";
    return "NLH";
}

const Table: React.FC<{ onOpenNav: () => void }> = ({ onOpenNav }) => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const tableId = id ?? "";
    const { currentNetwork } = useNetwork();
    const { gameState, gameFormat, gameVariant, gameCreator, isLoading, error, validationError, subscribeToTable, unsubscribeFromTable, getLatestSnapshot } =
        useGameState();
    const { showSuccess, showError, showWarning } = useToast();
    const legalActions = usePlayerLegalActions();
    const { balance: cosmosBalance } = useCosmosWallet();

    const [wagerAmount, setWagerAmount] = useState<string>("");
    /** Seat the player clicked to sit at; non-null while the join modal is open. */
    const [joinSeat, setJoinSeat] = useState<number | null>(null);
    /** Table whose Sit & Go registration prompt the viewer closed — it doesn't auto-reopen. */
    const [sngDismissedTable, setSngDismissedTable] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [logOpen, setLogOpen] = useState<boolean>(false);

    const hasWallet = !!getCosmosAddress();
    const localAddress = getCosmosAddress()?.toLowerCase() ?? null;
    const usdcBalanceAmount = cosmosBalance.find(b => b.denom === COSMOS_CONSTANTS.TOKEN_DENOM)?.amount ?? "0";

    useEffect(() => {
        if (!id || !hasWallet) {
            return;
        }
        subscribeToTable(id);
        return () => {
            unsubscribeFromTable();
        };
    }, [id, hasWallet, subscribeToTable, unsubscribeFromTable]);

    const validationMessage = validationError?.message;
    useEffect(() => {
        if (validationMessage !== undefined) {
            showWarning(`Validation: ${validationMessage}`);
        }
    }, [validationMessage, showWarning]);

    const runAction = async (label: string, action: () => Promise<PlayerActionResult | JoinTableResult | LeaveTableResult>): Promise<boolean> => {
        setIsSubmitting(true);
        try {
            await action();
            showSuccess(`${label} confirmed`);
            return true;
        } catch (err) {
            showError(err instanceof Error ? err.message : String(err));
            return false;
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
        () => undefined,
        blindType => showSuccess(`Posted ${blindType} blind`),
        err => showError(err.message)
    );

    useAutoDeal(
        tableId,
        currentNetwork,
        hasAction(legalActions.legalActions, NonPlayerActionType.DEAL),
        legalActions.isPlayerTurn,
        () => undefined,
        () => showSuccess("Cards dealt"),
        err => showError(err.message)
    );

    useAutoNewHand(
        tableId,
        currentNetwork,
        () => undefined,
        () => showSuccess("New hand started"),
        err => showError(err.message)
    );

    if (!hasWallet) {
        return (
            <div className={styles.page}>
                <NoWalletOverlay onConnect={() => navigate("/wallet")} onBack={() => navigate("/")} />
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.page}>
                <TableErrorPage message={error.message} onRetry={() => id && subscribeToTable(id)} onBack={() => navigate("/")} />
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
        isSitAndGoFormat(gameFormat) && isUserSeated && hasEmptySeats && gameState.round === TexasHoldemRound.ANTE
            ? {
                  prizePool: formatMicro(gameState.totalPot),
                  seated: gameState.players.length,
                  maxPlayers: gameState.gameOptions.maxPlayers,
              }
            : undefined;
    const waitingForPlayers =
        hasEmptySeats && gameState.players.length < gameState.gameOptions.minPlayers
            ? {
                  seated: gameState.players.length,
                  minPlayers: gameState.gameOptions.minPlayers,
                  maxPlayers: gameState.gameOptions.maxPlayers,
              }
            : undefined;

    const isTournamentBlinds = isSitAndGoFormat(gameFormat);

    // Sit & Go has no seat or amount to choose, so registration opens on its own
    // when an unseated viewer lands on the table. Clicking an open seat also opens it.
    const takenSeats = new Set(gameState.players.map(p => p.seat));
    let firstFreeSeat: number | null = null;
    for (let seat = 1; seat <= gameState.gameOptions.maxPlayers; seat++) {
        if (!takenSeats.has(seat)) {
            firstFreeSeat = seat;
            break;
        }
    }
    const autoPromptSeat = isTournamentBlinds && !isUserSeated && sngDismissedTable !== tableId ? firstFreeSeat : null;
    const modalSeat = isUserSeated ? null : (joinSeat ?? autoPromptSeat);
    const closeJoinModal = () => {
        setJoinSeat(null);
        setSngDismissedTable(tableId);
    };
    const blindText = (value: string) => (isTournamentBlinds ? value : formatMicro(value));
    const callMicro = legalActions.legalActions.find(a => a.action === PlayerActionType.CALL)?.min;
    const callDisplay = callMicro !== undefined ? (Number(callMicro) / 1_000_000).toFixed(2) : "0";

    const content = (
        <>
            <TableHeader
                tableLabel={`Table ${tableId.slice(0, 6)}…${tableId.slice(-4)}`}
                variantLabel={getVariantLabel(gameVariant !== undefined ? String(gameVariant) : undefined)}
                smallBlind={blindText(gameState.gameOptions.smallBlind)}
                bigBlind={blindText(gameState.gameOptions.bigBlind)}
                handNumber={gameState.handNumber}
                isCreatedByYou={gameCreator !== undefined && localAddress !== null && gameCreator.toLowerCase() === localAddress}
                onBack={() => navigate("/")}
                onLeave={isUserSeated ? () => runAction("Leave", () => leaveTable(tableId, currentNetwork)) : undefined}
                leaveDisabled={isSubmitting}
                onOpenNav={onOpenNav}
                onToggleLog={() => setLogOpen(open => !open)}
            />
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
                    maxBuyIn={gameState.gameOptions.maxBuyIn}
                    onVacantSeatClick={isUserSeated ? undefined : setJoinSeat}
                    communityCards={gameState.communityCards}
                    pot={isTournamentBlinds ? gameState.totalPot : formatMicro(gameState.totalPot)}
                    round={gameState.round}
                    sitAndGoWaiting={sitAndGoWaiting}
                    waitingForPlayers={waitingForPlayers}
                >
                    {logOpen && (
                        <HandLog
                            actions={gameState.previousActions}
                            handNumber={gameState.handNumber}
                            localAddress={localAddress}
                            formatAmount={isTournamentBlinds ? (micro: string) => micro : formatMicro}
                            onClose={() => setLogOpen(false)}
                            onReplay={() => navigate("/hand-history")}
                        />
                    )}
                </TableBoard>
            </div>
            {modalSeat !== null && (() => {
                const confirmJoin = async (amount: string) => {
                    const joined = await runAction("Join", () =>
                        joinTable(tableId, { amount, seatNumber: modalSeat }, currentNetwork, getLatestSnapshot)
                    );
                    if (joined) {
                        closeJoinModal();
                    }
                };
                const { gameOptions } = gameState;
                return isTournamentBlinds ? (
                    <SitAndGoJoinModal
                        seatNumber={modalSeat}
                        buyIn={gameOptions.minBuyIn}
                        entryFee={gameOptions.entryFee}
                        startingStack={gameOptions.startingStack}
                        blindLevelMinutes={gameOptions.blindLevelDuration}
                        smallBlind={gameOptions.smallBlind}
                        bigBlind={gameOptions.bigBlind}
                        seated={gameState.players.length}
                        maxPlayers={gameOptions.maxPlayers}
                        balance={usdcBalanceAmount}
                        isSubmitting={isSubmitting}
                        onConfirm={confirmJoin}
                        onClose={closeJoinModal}
                    />
                ) : (
                    <JoinTableModal
                        seatNumber={modalSeat}
                        minBuyIn={gameOptions.minBuyIn}
                        maxBuyIn={gameOptions.maxBuyIn}
                        balance={usdcBalanceAmount}
                        isSubmitting={isSubmitting}
                        onClose={closeJoinModal}
                        onConfirm={confirmJoin}
                    />
                );
            })()}
            {isUserSeated && !waitingForPlayers && !sitAndGoWaiting && (
                <PlayerActionButtons
                    isSubmitting={isSubmitting}
                    legalActions={legalActions.legalActions}
                    isPlayerTurn={legalActions.isPlayerTurn}
                    wagerAmount={wagerAmount}
                    onWagerChange={setWagerAmount}
                    potValue={isTournamentBlinds ? Number(gameState.totalPot) : Number(gameState.totalPot) / 1_000_000}
                    onBet={() => runAction("Bet", () => betHand(tableId, parseUsdcToMicro(wagerAmount), currentNetwork))}
                    onCall={() => runAction("Call", () => callHand(tableId, parseUsdcToMicro(callDisplay), currentNetwork))}
                    onRaise={() => runAction("Raise", () => raiseHand(tableId, parseUsdcToMicro(wagerAmount), currentNetwork))}
                    onCheck={() => runAction("Check", () => checkHand(tableId, currentNetwork))}
                    onFold={() => runAction("Fold", () => foldHand(tableId, currentNetwork))}
                    onMuck={() => runAction("Muck", () => muckCards(tableId, currentNetwork))}
                    onShow={() => runAction("Show", () => showCards(tableId, currentNetwork))}
                    onSitIn={() => runAction("Sit in", () => sitIn(tableId, currentNetwork))}
                    onSitInAndWait={() => runAction("Sit in and wait", () => sitInAndWait(tableId, currentNetwork))}
                />
            )}
        </>
    );

    return <div className={styles.page}>{content}</div>;
};

export default Table;
