/**
 * Result types for player-action hooks (bet, call, raise, fold, join,
 * leave, ...). Not SDK exports — desktop-local, mirroring ui's shapes.
 */

/** Result returned from player action hooks (bet, call, raise, fold, etc.). */
export interface PlayerActionResult {
    /** Transaction hash from the blockchain */
    hash: string;
    /** The game/table ID where the action was performed */
    gameId: string;
    /** The action that was performed (e.g., "bet", "call", "raise", "fold") */
    action: string;
    /** The amount involved in the action (in micro-units as string), if applicable */
    amount?: string;
}

/**
 * Result returned from joinTable.
 * Extends PlayerActionResult with join-specific properties.
 */
export interface JoinTableResult extends Omit<PlayerActionResult, "action"> {
    /** The seat number the player joined at */
    seat: number;
    /** The buy-in amount (in micro-units as string) */
    buyInAmount: string;
}

/**
 * Result returned from leaveTable. MsgLeaveGame carries no amount — the
 * chain decides the refund from its own state — so this is a thin alias
 * over PlayerActionResult.
 */
export type LeaveTableResult = PlayerActionResult;
