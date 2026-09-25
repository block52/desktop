import type { LegalActionDTO, PlayerStatus, SitInMethod } from "@block52/poker-vm-sdk";

export interface PlayerLegalActionsResult {
    legalActions: LegalActionDTO[];
    isSmallBlindPosition: boolean;
    isBigBlindPosition: boolean;
    isDealerPosition: boolean;
    isPlayerTurn: boolean;
    playerStatus: PlayerStatus | null;
    playerSeat: number | null;
    sitInMethod: SitInMethod | null;
    pendingSitOut: string | null;
    foldActionIndex: number | null;
    actionTurnIndex: number;
    isPlayerInGame: boolean;
    isLoading: boolean;
    error: Error | null;
}
