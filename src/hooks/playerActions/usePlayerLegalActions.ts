import { useMemo, useState } from "react";
import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { LegalActionDTO, PlayerDTO, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { useGameState } from "../../context/GameStateContext";
import { getCosmosAddress } from "../../utils/cosmos/storage";
import { hasElements } from "../../utils/guards";
import type { PlayerLegalActionsResult } from "./types";

/**
 * Pure computation: derive the current player's legal actions and table
 * position from a game-state snapshot. Extracted from the hook so it's
 * directly testable without React (no DOM/testing-library dependency).
 */
export function computeLegalActionsResult(
    gameState: TexasHoldemStateDTO | undefined,
    userAddress: string | null,
    isLoading: boolean,
    error: Error | null
): PlayerLegalActionsResult {
    const defaultReturn: PlayerLegalActionsResult = {
        legalActions: [],
        isSmallBlindPosition: false,
        isBigBlindPosition: false,
        isDealerPosition: false,
        isPlayerTurn: false,
        playerStatus: null,
        playerSeat: null,
        sitInMethod: null,
        pendingSitOut: null,
        isLoading,
        error,
        foldActionIndex: null,
        actionTurnIndex: 0,
        isPlayerInGame: false,
    };

    if (isLoading || error || !gameState || !userAddress) {
        return defaultReturn;
    }

    let currentPlayer: PlayerDTO | null = null;
    if (hasElements(gameState.players)) {
        currentPlayer = gameState.players.find(player => player.address.toLowerCase() === userAddress) ?? null;
    }

    if (!currentPlayer) {
        return defaultReturn;
    }

    const isPlayerTurn = gameState.nextToAct === currentPlayer.seat;

    let foldActionIndex: number | null = null;
    const foldAction = currentPlayer.legalActions.find((action: LegalActionDTO) => action.action === PlayerActionType.FOLD);
    if (foldAction) {
        foldActionIndex = foldAction.index;
    }

    const actionTurnIndex = hasElements(currentPlayer.legalActions) ? currentPlayer.legalActions[0].index : 0;

    return {
        legalActions: currentPlayer.legalActions,
        isSmallBlindPosition: currentPlayer.isSmallBlind || gameState.smallBlindPosition === currentPlayer.seat,
        isBigBlindPosition: currentPlayer.isBigBlind || gameState.bigBlindPosition === currentPlayer.seat,
        isDealerPosition: currentPlayer.isDealer || gameState.dealer === currentPlayer.seat,
        isPlayerTurn,
        // status/seat are required (non-optional) on PlayerDTO once
        // currentPlayer is resolved — no fallback needed here.
        playerStatus: currentPlayer.status,
        playerSeat: currentPlayer.seat,
        sitInMethod: currentPlayer.sitInMethod === undefined ? null : currentPlayer.sitInMethod,
        pendingSitOut: currentPlayer.pendingSitOut === undefined ? null : currentPlayer.pendingSitOut,
        isLoading: false,
        error: null,
        foldActionIndex,
        actionTurnIndex,
        isPlayerInGame: true,
    };
}

/**
 * Computes the current player's legal actions and table position from the
 * live game-state snapshot. Table identification and subscription are
 * handled by GameStateContext — components call subscribeToTable(tableId)
 * separately; this hook only reads the resulting state.
 */
export function usePlayerLegalActions(): PlayerLegalActionsResult {
    // Wallet address is stable for the session — read once via useState's
    // initializer so a synchronous read doesn't trigger an extra render.
    const [userAddress] = useState<string | null>(() => {
        const address = getCosmosAddress();
        return address ? address.toLowerCase() : null;
    });

    const { gameState, isLoading, error } = useGameState();

    return useMemo(
        () => computeLegalActionsResult(gameState, userAddress, isLoading, error),
        [gameState, userAddress, isLoading, error]
    );
}
