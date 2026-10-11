import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { COSMOS_CONSTANTS, PlayerActionType, NonPlayerActionType, TexasHoldemRound, GameVariant, PlayerStatus, hasAction, isSitAndGoFormat } from "@block52/poker-vm-sdk";
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
import { microToDecimal, parseUsdcToMicro } from "../../utils/currency";
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
import { TopUpModal } from "../../components/modal/TopUpModal";
import { topUpTable, type TopUpResult } from "../../hooks/playerActions/topUp";
import { maxTopUpMicro } from "../../utils/topUpLimits";
import { ConnectionBanner } from "../../components/table/ConnectionBanner";
import { StepButtons, type BlockingStep } from "../../components/table/StepButtons";
import { TournamentStrip } from "../../components/table/TournamentStrip";
import { primaryAction } from "../../components/table/PlayerActionButtons";
import { LeaveTableModal } from "../../components/modal/LeaveTableModal";
import { SitAndGoResultModal } from "../../components/modal/SitAndGoResultModal";
import { claimWinnings } from "../../hooks/playerActions/claimWinnings";
import { useGameSettings } from "../../hooks/useGameSettings";
import { useTableSounds } from "../../hooks/useTableSounds";
import { useTurnTimer } from "../../hooks/useTurnTimer";
import { useAutoFold, useAutoMuck, useAutoShowCards, usePreCheck } from "../../hooks/playerActions/useAutoActions";
import { postSmallBlind } from "../../hooks/playerActions/postSmallBlind";
import { postBigBlind } from "../../hooks/playerActions/postBigBlind";
import { dealCardsWithEntropy } from "../../hooks/playerActions/dealCards";
import { getPlayerActionDisplay } from "../../utils/playerActionDisplay";
import { sitOut } from "../../hooks/playerActions/sitOut";
import { useAutoSitOutNextBB } from "../../hooks/playerActions/useAutoSitOutNextBB";
import { describeHandStrength } from "../../utils/handStrength";
import { isCheckFreeForPlayer } from "../../utils/checkFree";
import { loadTableTheme, nextTableTheme, saveTableTheme, type TableTheme } from "../../config/tableTheme";
import styles from "./Table.module.css";

function formatMicro(value: string): string {
    return (Number(value) / 1_000_000).toFixed(3);
}

/** Sit & Go amounts are whole tournament chips, shown with thousands separators and no currency. */
function formatChips(value: string): string {
    return Number(value).toLocaleString("en-US");
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
    const { gameState, gameFormat, gameVariant, gameCreator, isLoading, error, validationError, subscribeToTable, unsubscribeFromTable, getLatestSnapshot, connection, retryConnection } =
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
    /** Which action is in flight ("Call", "Bet", ...), so its button can show a spinner. */
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    /** An action that was accepted but whose result has not reached the table yet. */
    const [awaitingFrame, setAwaitingFrame] = useState<{ label: string; actionCount: number } | null>(null);
    /** What the game is doing for the player automatically ("Posting small blind…"). */
    const [autoActivity, setAutoActivity] = useState<string | null>(null);
    const [logOpen, setLogOpen] = useState<boolean>(false);
    const [leaveOpen, setLeaveOpen] = useState<boolean>(false);
    const [topUpOpen, setTopUpOpen] = useState<boolean>(false);
    /** Tables whose Sit & Go result dialog the player closed (remembered per table and wallet). */
    const [resultDismissed, setResultDismissed] = useState<Record<string, boolean>>({});
    const settings = useGameSettings();
    // Actions pause while the live feed is stale: the table on screen may not match the chain.
    const isFeedStale = connection.status !== "live";
    const turn = useTurnTimer(gameState);
    /** Pre-selected "Check": ephemeral per-round intent, not a saved setting. */
    const [preCheckQueued, setPreCheckQueued] = useState<boolean>(false);
    /** "Sit out next hand": an optimistic overlay on the chain's pendingSitOut, cleared when the chain reports. */
    const [sitOutNextHandOptimistic, setSitOutNextHandOptimistic] = useState<{ source: string | null; checked: boolean } | null>(null);
    /** "Sit out next big blind": held in the app until the big blind reaches the seat. */
    const [sitOutNextBbQueued, setSitOutNextBbQueued] = useState<boolean>(false);
    const [tableTheme, setTableTheme] = useState<TableTheme>(loadTableTheme);
    const cycleTheme = () => {
        const next = nextTableTheme(tableTheme);
        setTableTheme(next);
        saveTableTheme(next);
    };

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

    const runAction = async (label: string, action: () => Promise<PlayerActionResult | JoinTableResult | LeaveTableResult | TopUpResult>): Promise<boolean> => {
        setIsSubmitting(true);
        setPendingAction(label);
        try {
            await action();
            // Accepted by the chain, but the table only moves on when its next frame arrives: keep the
            // spinner until then (or the safety timeout below), so the click never looks like it did nothing.
            setAwaitingFrame({ label, actionCount: gameState?.previousActions.length ?? 0 });
            showSuccess(`${label} confirmed`);
            return true;
        } catch (err) {
            showError(err instanceof Error ? err.message : String(err));
            return false;
        } finally {
            setIsSubmitting(false);
            setPendingAction(null);
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
        blindType => setAutoActivity(blindType === "small" ? "Posting small blind…" : "Posting big blind…"),
        blindType => {
            setAutoActivity(null);
            // Accepted by the chain; keep the button working until the table's next frame shows it.
            setAwaitingFrame({ label: blindType === "small" ? "Post small blind" : "Post big blind", actionCount: gameState?.previousActions.length ?? 0 });
            showSuccess(`Posted ${blindType} blind`);
        },
        err => {
            setAutoActivity(null);
            showError(err.message);
        },
        settings.autoPostBlinds
    );

    useAutoDeal(
        tableId,
        currentNetwork,
        hasAction(legalActions.legalActions, NonPlayerActionType.DEAL),
        legalActions.isPlayerTurn,
        () => setAutoActivity("Dealing cards…"),
        () => {
            setAutoActivity(null);
            setAwaitingFrame({ label: "Deal", actionCount: gameState?.previousActions.length ?? 0 });
            showSuccess("Cards dealt");
        },
        err => {
            setAutoActivity(null);
            showError(err.message);
        },
        settings.autoDeal
    );

    useAutoNewHand(
        tableId,
        currentNetwork,
        () => setAutoActivity("Starting next hand…"),
        () => {
            setAutoActivity(null);
            showSuccess("New hand started");
        },
        err => {
            setAutoActivity(null);
            showError(err.message);
        },
        settings.autoNewHand
    );

    // Clear the "waiting for the table" spinner once a new action lands, or after a safety timeout.
    const actionCountNow = gameState?.previousActions.length;
    useEffect(() => {
        if (awaitingFrame === null) return;
        if (actionCountNow !== undefined && actionCountNow !== awaitingFrame.actionCount) {
            setAwaitingFrame(null);
            return;
        }
        const timer = setTimeout(() => setAwaitingFrame(null), 8000);
        return () => clearTimeout(timer);
    }, [awaitingFrame, actionCountNow]);

    const hasFoldAction = hasAction(legalActions.legalActions, PlayerActionType.FOLD);
    const hasCheckAction = hasAction(legalActions.legalActions, PlayerActionType.CHECK);
    const hasMuckAction = hasAction(legalActions.legalActions, PlayerActionType.MUCK);
    const hasShowAction = hasAction(legalActions.legalActions, PlayerActionType.SHOW);
    const isUsersTurn = legalActions.isPlayerTurn;

    // ---- Sitting in (cash): what the panel offers, and the automatic sit-in for a fresh joiner ----
    const seatDisplay = getPlayerActionDisplay({
        playerStatus: legalActions.playerStatus,
        sitInMethod: legalActions.sitInMethod,
        legalActions: legalActions.legalActions,
        totalSeatedPlayers: gameState?.players.length ?? 0,
        handNumber: gameState?.handNumber ?? 0,
        hasActivePlayers: gameState?.players.some(p => p.status === PlayerStatus.ACTIVE || p.status === PlayerStatus.ALL_IN) ?? false,
        sitInOptions: settings.sitInOptions,
        gameFormat
    });
    const autoSitInFired = useRef<boolean>(false);
    const wantsAutoSitIn = seatDisplay.kind === "auto-sit-in" && !isFeedStale && legalActions.isPlayerInGame;
    useEffect(() => {
        if (wantsAutoSitIn && !autoSitInFired.current) {
            autoSitInFired.current = true;
            setAutoActivity("Sitting you in…");
            sitIn(tableId, currentNetwork)
                .then(() => {
                    setAwaitingFrame({ label: "Sit in", actionCount: gameState?.previousActions.length ?? 0 });
                })
                .catch(err => showError(err instanceof Error ? err.message : String(err)))
                .finally(() => setAutoActivity(null));
        }
        if (!wantsAutoSitIn) {
            autoSitInFired.current = false;
        }
    }, [wantsAutoSitIn, tableId, currentNetwork, showError, gameState?.previousActions.length]);
    useTableSounds({
        previousActions: gameState?.previousActions,
        isUsersTurn,
        actionSounds: settings.playerActionSounds,
        turnSound: settings.turnNotificationSound
    });

    // Fold (or check when free) when the turn clock runs out; show cards the same way at showdown.
    useAutoFold({
        enabled: settings.autoFold,
        hasFoldAction,
        hasCheckAction,
        isUsersTurn,
        timeRemaining: turn.timeRemaining,
        isBusy: isSubmitting || isFeedStale,
        fold: () => foldHand(tableId, currentNetwork),
        check: () => checkHand(tableId, currentNetwork),
        onSubmitted: action => showWarning(action === "check" ? "Time ran out — checked for you" : "Time ran out — folded for you"),
        onError: err => showError(err.message)
    });
    useAutoShowCards({
        hasShowAction,
        isUsersTurn,
        timeRemaining: turn.timeRemaining,
        isBusy: isSubmitting || isFeedStale,
        show: () => showCards(tableId, currentNetwork),
        onError: err => showError(err.message)
    });
    useAutoMuck({
        enabled: settings.autoMuck,
        hasMuckAction,
        isUsersTurn,
        isBusy: isSubmitting || isFeedStale,
        muck: () => muckCards(tableId, currentNetwork),
        onError: err => showError(err.message)
    });

    // ---- Sit out (cash games only: tournament seats never sit out voluntarily) ----
    const pendingSitOut = legalActions.pendingSitOut;
    const sitOutAllowed = !isSitAndGoFormat(gameFormat) && hasAction(legalActions.legalActions, NonPlayerActionType.SIT_OUT);
    const sitOutNextHandChecked =
        sitOutNextHandOptimistic !== null && sitOutNextHandOptimistic.source === pendingSitOut
            ? sitOutNextHandOptimistic.checked
            : pendingSitOut === "next-hand";
    const submitSitOut = () => {
        void sitOut(tableId, currentNetwork).catch(err => {
            setSitOutNextHandOptimistic(null);
            showError(err instanceof Error ? err.message : String(err));
        });
    };
    const toggleSitOutNextHand = () => {
        setSitOutNextHandOptimistic({ source: pendingSitOut, checked: !sitOutNextHandChecked });
        submitSitOut();
    };
    useAutoSitOutNextBB(
        legalActions.playerSeat ?? undefined,
        gameState?.bigBlindPosition,
        sitOutNextBbQueued && sitOutAllowed,
        () => {
            submitSitOut();
            setSitOutNextBbQueued(false);
        }
    );

    // "Checking is free for me right now" — offered before the turn, only while seated in the hand.
    const myPlayer = gameState?.players.find(p => p.address.toLowerCase() === localAddress);
    const isCheckFree =
        gameState !== undefined &&
        myPlayer !== undefined &&
        isCheckFreeForPlayer(gameState.players, myPlayer.address, gameState.round, gameState.previousActions);
    const showPreCheck = settings.preSelectCheck && !isUsersTurn && myPlayer?.status === PlayerStatus.ACTIVE && isCheckFree;
    // A bet landing (or leaving the hand) before the turn arrives withdraws the intent; on the turn itself it is consumed.
    const preCheckStillValid = showPreCheck || isUsersTurn;
    if (preCheckQueued && !preCheckStillValid) {
        setPreCheckQueued(false);
    }
    usePreCheck({
        queued: preCheckQueued,
        hasCheckAction,
        isUsersTurn,
        isBusy: isSubmitting || isFeedStale,
        check: () => checkHand(tableId, currentNetwork),
        onResolved: () => setPreCheckQueued(false),
        onError: err => showError(err.message)
    });

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
                <div className={styles.connecting} role="status">
                    <span className={styles.spinner} aria-hidden="true" />
                    <span className={styles.connectingTitle}>Entering the table…</span>
                    {id !== undefined && (
                        <span className={styles.connectingId}>
                            {id.slice(0, 8)}…{id.slice(-6)}
                        </span>
                    )}
                </div>
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
    const totalPotMicro = BigInt(gameState.totalPot);
    const mainPotMicro = gameState.pots.length > 0 ? BigInt(gameState.pots[0]) : 0n;
    const isPreflopRound = gameState.round === TexasHoldemRound.ANTE || gameState.round === TexasHoldemRound.PREFLOP;
    const showMainPot = !isPreflopRound && mainPotMicro > 0n && mainPotMicro !== totalPotMicro;
    const formatAmount = isTournamentBlinds ? formatChips : formatMicro;
    const potText = (raw: bigint) => (isTournamentBlinds ? formatChips(raw.toString()) : `$${formatMicro(raw.toString())}`);
    // Sit & Go amounts are tournament chips; cash amounts are micro-USDC.
    const chipValue = (amount: string) => (isTournamentBlinds ? Number(amount) : Number(amount) / 1_000_000);
    const winnersBySeat = new Map(
        gameState.winners.map(w => [w.seat, { amount: formatAmount(w.amount), description: w.description }] as const)
    );
    const resultsByAddress = new Map(
        gameState.results.map(r => [
            r.playerId.toLowerCase(),
            { place: r.place, payout: r.payout !== "0" ? `$${(Number(r.payout) / 1_000_000).toFixed(2)}` : undefined }
        ] as const)
    );
    const winningCards = gameState.winners.flatMap(w => w.cards ?? []).map(code => code.toUpperCase());
    const blindText = (value: string) => formatAmount(value);
    const callMicro = legalActions.legalActions.find(a => a.action === PlayerActionType.CALL)?.min;
    // A bet or raise must carry an amount: until the player picks one it defaults to the action's minimum.
    const betSpec = primaryAction(legalActions.legalActions);
    const wagerDisplay =
        wagerAmount.trim() !== ""
            ? wagerAmount
            : betSpec !== null
              ? isTournamentBlinds
                  ? betSpec.min
                  : microToDecimal(BigInt(betSpec.min))
              : "";
    const callRaw = callMicro !== undefined ? BigInt(callMicro) : 0n;
    // Wagers are typed in display units; the chain wants raw units (micro-USDC, or chips for a Sit & Go).
    const toRaw = (display: string) => (isTournamentBlinds ? BigInt(Math.round(Number(display))) : parseUsdcToMicro(display));

    // ---- Leaving, and the end of a Sit & Go ----
    // The chain drops LEAVE from the legal actions once a tournament has started (the roster is frozen).
    const canLeave = isUserSeated && hasAction(legalActions.legalActions, NonPlayerActionType.LEAVE);
    const isInActiveHand =
        myPlayer !== undefined &&
        (myPlayer.status === PlayerStatus.ACTIVE || myPlayer.status === PlayerStatus.ALL_IN) &&
        gameState.round !== TexasHoldemRound.ANTE &&
        gameState.round !== TexasHoldemRound.END;
    const leaveReturnAmount = isTournamentBlinds
        ? `$${(Number(gameState.gameOptions.minBuyIn) / 1_000_000).toFixed(2)}`
        : `$${((myPlayer !== undefined ? Number(myPlayer.stack) : 0) / 1_000_000).toFixed(2)}`;

    // Top-up is a cash-game, between-hands action: visible while seated, enabled when the chain offers TOP_UP.
    const topUpVisible = isUserSeated && !isTournamentBlinds;
    const canTopUp = topUpVisible && hasAction(legalActions.legalActions, NonPlayerActionType.TOP_UP);
    const maxTopUp =
        myPlayer !== undefined
            ? maxTopUpMicro(BigInt(myPlayer.stack), BigInt(gameState.gameOptions.maxBuyIn), BigInt(usdcBalanceAmount))
            : 0n;

    const isFolded = myPlayer?.status === PlayerStatus.FOLDED;

    const myResult = localAddress !== null ? gameState.results.find(r => r.playerId.toLowerCase() === localAddress) : undefined;
    const resultKey = `viewed_sng_result_${tableId}_${localAddress ?? ""}`;
    const isResultDismissed = resultDismissed[resultKey] ?? (() => {
        try {
            return localStorage.getItem(resultKey) === "true";
        } catch {
            return false;
        }
    })();
    const dismissResult = () => {
        try {
            localStorage.setItem(resultKey, "true");
        } catch {
            // Not remembered across reloads.
        }
        setResultDismissed(prev => ({ ...prev, [resultKey]: true }));
    };
    const showResult = isTournamentBlinds && myResult !== undefined && !isResultDismissed;

    // ---- Blind and deal steps (driven automatically; the buttons show them and allow a manual press) ----
    const smallBlindDue = hasAction(legalActions.legalActions, PlayerActionType.SMALL_BLIND);
    const bigBlindDue = hasAction(legalActions.legalActions, PlayerActionType.BIG_BLIND);
    const dealDue = hasAction(legalActions.legalActions, NonPlayerActionType.DEAL);
    const stepDue = smallBlindDue || bigBlindDue || dealDue;
    // In flight (by hand or automatically) or accepted and waiting for the table to move on.
    const stepLabel = pendingAction ?? awaitingFrame?.label ?? null;
    const blockingStep: BlockingStep =
        autoActivity === "Posting small blind…" || stepLabel === "Post small blind"
            ? "small-blind"
            : autoActivity === "Posting big blind…" || stepLabel === "Post big blind"
              ? "big-blind"
              : autoActivity === "Dealing cards…" || stepLabel === "Deal"
                ? "deal"
                : null;
    const stepButtons =
        isUserSeated && stepDue ? (
            <StepButtons
                showSmallBlind={smallBlindDue}
                showBigBlind={bigBlindDue}
                smallAmount={formatAmount(gameState.gameOptions.smallBlind)}
                bigAmount={formatAmount(gameState.gameOptions.bigBlind)}
                currencySymbol={isTournamentBlinds ? "" : "$"}
                canDeal={dealDue}
                handNumber={gameState.handNumber}
                blockingStep={blockingStep}
                disabled={isSubmitting || isFeedStale}
                onPostSmall={() => runAction("Post small blind", () => postSmallBlind(tableId, smallBlindAmount, currentNetwork))}
                onPostBig={() => runAction("Post big blind", () => postBigBlind(tableId, bigBlindAmount, currentNetwork))}
                onDeal={() => runAction("Deal", () => dealCardsWithEntropy(tableId, currentNetwork, ""))}
            />
        ) : undefined;

    const content = (
        <>
            <ConnectionBanner connection={connection} onRetry={retryConnection} />
            <TableHeader
                tableLabel={`Table ${tableId.slice(0, 6)}…${tableId.slice(-4)}`}
                tableId={tableId}
                variantLabel={getVariantLabel(gameVariant !== undefined ? String(gameVariant) : undefined)}
                smallBlind={blindText(gameState.gameOptions.smallBlind)}
                bigBlind={blindText(gameState.gameOptions.bigBlind)}
                handNumber={gameState.handNumber}
                isCreatedByYou={gameCreator !== undefined && localAddress !== null && gameCreator.toLowerCase() === localAddress}
                onBack={() => navigate("/")}
                onLeave={canLeave ? () => setLeaveOpen(true) : undefined}
                leaveDisabled={isSubmitting}
                onOpenNav={onOpenNav}
                onToggleLog={() => setLogOpen(open => !open)}
                theme={tableTheme}
                onCycleTheme={cycleTheme}
                settings={settings}
                onToggleSetting={settings.toggle}
            />
            {isTournamentBlinds && gameState.gameOptions.blindLevelDuration !== undefined && (
                <TournamentStrip
                    level={gameState.gameOptions.blindLevel}
                    smallBlind={formatChips(gameState.gameOptions.smallBlind)}
                    bigBlind={formatChips(gameState.gameOptions.bigBlind)}
                    nextSmallBlind={
                        gameState.gameOptions.nextSmallBlind !== undefined ? formatChips(gameState.gameOptions.nextSmallBlind) : undefined
                    }
                    nextBigBlind={gameState.gameOptions.nextBigBlind !== undefined ? formatChips(gameState.gameOptions.nextBigBlind) : undefined}
                    levelStartTime={gameState.gameOptions.levelStartTime}
                    levelDurationMinutes={gameState.gameOptions.blindLevelDuration}
                    prizes={
                        gameState.payouts !== undefined
                            ? gameState.payouts.map(p => ({ place: p.place, amount: `$${(Number(p.amount) / 1_000_000).toFixed(2)}` }))
                            : []
                    }
                />
            )}
            <div className={styles.boardRow}>
                <TableBoard
                    players={gameState.players}
                    maxPlayers={gameState.gameOptions.maxPlayers}
                    localAddress={localAddress}
                    nextToAct={gameState.nextToAct}
                    smallBlindPosition={gameState.smallBlindPosition}
                    bigBlindPosition={gameState.bigBlindPosition}
                    dealer={gameState.dealer}
                    formatStack={formatAmount}
                    chipValue={chipValue}
                    turnTimeoutSec={turn.timeoutSeconds}
                    turnRemainingSec={turn.timeRemaining}
                    turnKey={turn.turnKey}
                    resultsByAddress={resultsByAddress}
                    winnersBySeat={winnersBySeat}
                    winningCards={winningCards}
                    maxBuyIn={gameState.gameOptions.maxBuyIn}
                    onVacantSeatClick={isUserSeated ? undefined : setJoinSeat}
                    communityCards={gameState.communityCards}
                    pot={potText(totalPotMicro)}
                    hasPot={totalPotMicro > 0n}
                    potValue={chipValue(gameState.totalPot)}
                    mainPot={showMainPot ? potText(mainPotMicro) : undefined}
                    round={gameState.round}
                    theme={tableTheme}
                    sitAndGoWaiting={sitAndGoWaiting}
                    waitingForPlayers={waitingForPlayers}
                >
                    {stepButtons !== undefined && <div className={styles.stepDock}>{stepButtons}</div>}
                    <button
                        type="button"
                        className={styles.historyTab}
                        onClick={() => setLogOpen(open => !open)}
                        aria-expanded={logOpen}
                        aria-label="Hand history"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m15 18-6-6 6-6" />
                        </svg>
                        <span>History</span>
                    </button>
                    {topUpVisible && (
                        <button
                            type="button"
                            className={styles.topUpButton}
                            disabled={!canTopUp || isSubmitting}
                            onClick={() => setTopUpOpen(true)}
                            title={canTopUp ? "Add chips to your stack" : "You can add chips between hands, not while you are in the current hand."}
                        >
                            <span aria-hidden="true">💰</span> Top-up chips
                        </button>
                    )}
                    {logOpen && (
                        <HandLog
                            actions={gameState.previousActions}
                            handNumber={gameState.handNumber}
                            localAddress={localAddress}
                            formatAmount={formatAmount}
                            currencySymbol={isTournamentBlinds ? "" : "$"}
                            onClose={() => setLogOpen(false)}
                            onReplay={() => navigate("/hand-history")}
                        />
                    )}
                </TableBoard>
            </div>
            {leaveOpen && canLeave && (
                <LeaveTableModal
                    returnAmount={leaveReturnAmount}
                    isTournament={isTournamentBlinds}
                    isInActiveHand={isInActiveHand}
                    isSubmitting={isSubmitting}
                    onClose={() => setLeaveOpen(false)}
                    onConfirm={async () => {
                        const left = await runAction("Leave", () => leaveTable(tableId, currentNetwork));
                        if (left) setLeaveOpen(false);
                    }}
                />
            )}
            {topUpOpen && canTopUp && myPlayer !== undefined && (
                <TopUpModal
                    stack={BigInt(myPlayer.stack)}
                    maxAddable={maxTopUp}
                    isSubmitting={isSubmitting}
                    onClose={() => setTopUpOpen(false)}
                    onConfirm={async amount => {
                        const added = await runAction("Top up", () => topUpTable(tableId, currentNetwork, amount));
                        if (added) setTopUpOpen(false);
                    }}
                />
            )}
            {showResult && myResult !== undefined && (
                <SitAndGoResultModal
                    place={myResult.place}
                    payout={myResult.payout !== "0" ? `$${(Number(myResult.payout) / 1_000_000).toFixed(2)}` : undefined}
                    onClose={dismissResult}
                    onClaim={async () => {
                        await claimWinnings(tableId, currentNetwork, gameState);
                        showSuccess("Prize collected");
                    }}
                    onLeave={async () => {
                        await leaveTable(tableId, currentNetwork);
                        showSuccess("Left the table");
                        dismissResult();
                    }}
                />
            )}
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
                    isSubmitting={isSubmitting || isFeedStale}
                    legalActions={legalActions.legalActions}
                    isPlayerTurn={legalActions.isPlayerTurn}
                    wagerAmount={wagerDisplay}
                    onWagerChange={setWagerAmount}
                    potValue={chipValue(gameState.totalPot)}
                    sitOut={
                        sitOutAllowed
                            ? {
                                  nextHandChecked: sitOutNextHandChecked,
                                  nextBbChecked: sitOutNextBbQueued,
                                  onToggleNextHand: toggleSitOutNextHand,
                                  onToggleNextBb: () => setSitOutNextBbQueued(queued => !queued)
                              }
                            : undefined
                    }
                    handLabel={isFolded ? null : describeHandStrength(myPlayer?.holeCards ?? undefined, gameState.communityCards)}
                    stepActive={stepDue}
                    sitInMode={
                        seatDisplay.kind === "sit-in-bootstrap" ? "bootstrap" : seatDisplay.kind === "sit-in-options" ? "options" : "none"
                    }
                    seatNotice={
                        seatDisplay.kind === "pending"
                            ? seatDisplay.waitingMessage
                            : seatDisplay.kind === "waiting-for-players"
                              ? "Waiting for players to join…"
                              : seatDisplay.kind === "auto-sit-in"
                                ? "Sitting you in…"
                                : null
                    }
                    pendingAction={pendingAction ?? awaitingFrame?.label ?? null}
                    activity={autoActivity}
                    bigBlind={gameState.gameOptions.bigBlind}
                    showPreCheck={showPreCheck}
                    preCheckQueued={preCheckQueued}
                    onPreCheckChange={setPreCheckQueued}
                    microPerUnit={isTournamentBlinds ? 1 : 1_000_000}
                    currencySymbol={isTournamentBlinds ? "" : "$"}
                    onBet={() => runAction("Bet", () => betHand(tableId, toRaw(wagerDisplay), currentNetwork))}
                    onCall={() => runAction("Call", () => callHand(tableId, callRaw, currentNetwork))}
                    onRaise={() => runAction("Raise", () => raiseHand(tableId, toRaw(wagerDisplay), currentNetwork))}
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
