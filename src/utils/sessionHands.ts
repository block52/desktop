import type { IndexedHand, PlayerHand, PlayerSession } from "./indexer";

/**
 * Hands the wallet was seated for in one table session, newest first. A hand counts when it finished while
 * the player was at the table: at or after the join block, and no later than the leave block (open-ended
 * while they are still seated). Seat, cards and result are not known from a session, so the hand is marked
 * `estimated`.
 */
export function handsInSession(session: PlayerSession, tableHands: readonly IndexedHand[]): PlayerHand[] {
    return tableHands
        .filter(hand => hand.game_id === session.game_id)
        .filter(hand => hand.block_height >= session.join_block)
        .filter(hand => session.leave_block === undefined || hand.block_height <= session.leave_block)
        .map(hand => ({
            game_id: hand.game_id,
            hand_number: hand.hand_number,
            seat: 0,
            status: "",
            won_amount: 0,
            block_height: hand.block_height,
            ended_at: hand.created_at,
            community_cards: [],
            winner_count: 0,
            estimated: true
        }))
        .sort((a, b) => b.block_height - a.block_height);
}
