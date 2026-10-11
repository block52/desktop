import { NonPlayerActionType, PlayerStatus, SIT_IN_METHOD_POST_NOW, isCashFormat, type LegalActionDTO } from "@block52/poker-vm-sdk";

/** What the seated player's panel should offer around sitting in and out (ported from the web app). */
export type PlayerActionDisplay =
    /** Sit-in confirmed or parked: show a passive waiting message. */
    | { kind: "pending"; waitingMessage: string }
    /** Alone at the table. */
    | { kind: "waiting-for-players" }
    /** Fresh joiner: sit them in automatically (post now, dealt in next hand). */
    | { kind: "auto-sit-in" }
    /** Empty table, first hand: a single explicit "Sit in". */
    | { kind: "sit-in-bootstrap" }
    /** Mid-orbit: choose to post now or wait for the big blind. */
    | { kind: "sit-in-options" }
    /** Cash game: the sit-out toggles. */
    | { kind: "sit-out-button" }
    | { kind: "none" };

export interface PlayerActionDisplayInput {
    playerStatus: string | null;
    sitInMethod: string | null;
    legalActions: readonly LegalActionDTO[];
    totalSeatedPlayers: number;
    handNumber: number;
    hasActivePlayers: boolean;
    /** When false (default) a would-be sit-in panel becomes "auto-sit-in". */
    sitInOptions: boolean;
    gameFormat: string | undefined;
}

/** Sit-out options are cash-only: in a Sit & Go or tournament everyone with chips is dealt into every hand. */
export function allowsVoluntarySitOut(gameFormat: string | undefined): boolean {
    return isCashFormat(gameFormat);
}

/**
 * The empty-table first fill: nobody is active and it is the first hand. There is no orbit yet, so the
 * "post now vs next big blind" choice is meaningless and a single Sit in is shown.
 */
export function isBootstrap(hasActivePlayers: boolean, handNumber: number): boolean {
    return !hasActivePlayers && handNumber === 1;
}

export function getPlayerActionDisplay(input: PlayerActionDisplayInput): PlayerActionDisplay {
    const { playerStatus, sitInMethod, legalActions, totalSeatedPlayers, handNumber, hasActivePlayers, sitInOptions, gameFormat } = input;

    const hasSitInAction = legalActions.some(a => a.action === NonPlayerActionType.SIT_IN);
    const hasSitOutAction = legalActions.some(a => a.action === NonPlayerActionType.SIT_OUT);

    // Sit-in already confirmed, waiting for the table.
    if (playerStatus === PlayerStatus.SITTING_IN) {
        const postNow = sitInMethod === SIT_IN_METHOD_POST_NOW || sitInMethod === null;
        return { kind: "pending", waitingMessage: postNow ? "Waiting to sit in…" : "Waiting for next big blind…" };
    }

    // A cash joiner is parked until their big blind comes round; the engine offers only top-up / leave.
    if (playerStatus === PlayerStatus.WAITING_FOR_BIG_BLIND) {
        return { kind: "pending", waitingMessage: "Waiting for next big blind…" };
    }

    if (totalSeatedPlayers < 2) {
        return { kind: "waiting-for-players" };
    }

    if (hasSitInAction) {
        // Someone who deliberately sat out must opt back in themselves; auto-driving it would undo the sit-out.
        const deliberatelySatOut = playerStatus === PlayerStatus.SITTING_OUT;
        if (!sitInOptions && !deliberatelySatOut) {
            return { kind: "auto-sit-in" };
        }
        return isBootstrap(hasActivePlayers, handNumber) ? { kind: "sit-in-bootstrap" } : { kind: "sit-in-options" };
    }

    if (hasSitOutAction && allowsVoluntarySitOut(gameFormat)) {
        return { kind: "sit-out-button" };
    }

    return { kind: "none" };
}
