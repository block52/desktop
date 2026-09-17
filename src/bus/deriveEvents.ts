/**
 * Event derivation.
 *
 * `deriveEvents(prev, next)` is a PURE function that diffs two consecutive game
 * snapshots and returns the typed transitions that happened between them.
 *
 * Key semantics:
 *
 *   - Action indices are GLOBALLY MONOTONIC across hands. The `previousActions`
 *     array is replaced with the current hand's actions each hand, but indices
 *     keep climbing. So the dedup baseline is simply the max index present in
 *     `prev.previousActions` — the persistent `lastSeenIndex`, with NO per-hand
 *     reset. Every `previousActions` entry in `next` with `index > baseline`
 *     yields one `playerActed`, in index order.
 *
 *   - `prev === undefined` (first frame after subscribe/reset) → NO synthetic
 *     events. History is not replayed as fresh events; the frame simply becomes
 *     the baseline for the next call.
 *
 *   - A regressed snapshot (indices go backwards while the hand number is
 *     unchanged) is NOT silently accepted — it throws {@link RegressedSnapshotError}.
 *     The caller should surface this (e.g. console.error) and still commit the
 *     frame with no events — the snapshot itself is never dropped.
 */
import type { TexasHoldemStateDTO, ActionDTO, PlayerDTO } from "@block52/poker-vm-sdk";
import { TexasHoldemRound } from "@block52/poker-vm-sdk";
import type { GameEvent } from "./types";
import { hasElements, isEmpty } from "../utils/guards";

/**
 * Thrown by {@link deriveEvents} when a same-hand snapshot's action indices
 * regress (a stale/out-of-order frame). Surfaced by the caller, never swallowed.
 */
export class RegressedSnapshotError extends Error {
    public readonly prevMaxIndex: number;
    public readonly nextMaxIndex: number;
    public readonly handNumber: number;

    constructor(prevMaxIndex: number, nextMaxIndex: number, handNumber: number) {
        super(
            `Regressed snapshot: previousActions max index went backwards from ${prevMaxIndex} to ${nextMaxIndex} ` +
                `without a handNumber change (hand ${handNumber}). Refusing to derive events from a stale frame.`
        );
        this.name = "RegressedSnapshotError";
        this.prevMaxIndex = prevMaxIndex;
        this.nextMaxIndex = nextMaxIndex;
        this.handNumber = handNumber;
    }
}

const ROUND_ORDER: readonly TexasHoldemRound[] = [
    TexasHoldemRound.ANTE,
    TexasHoldemRound.PREFLOP,
    TexasHoldemRound.FLOP,
    TexasHoldemRound.TURN,
    TexasHoldemRound.RIVER,
    TexasHoldemRound.SHOWDOWN,
    TexasHoldemRound.END,
];

function roundOrder(round: TexasHoldemRound): number {
    return ROUND_ORDER.indexOf(round);
}

function maxActionIndex(actions: readonly ActionDTO[] | undefined): number | null {
    if (!actions || actions.length === 0) {
        return null;
    }
    let max = actions[0].index;
    for (const action of actions) {
        if (action.index > max) {
            max = action.index;
        }
    }
    return max;
}

function isMaskedCard(card: string): boolean {
    return card === "X" || card === "??";
}

export function isMaskedHand(cards: string[] | undefined): boolean {
    return hasElements(cards) && cards.every(isMaskedCard);
}

export function isRevealedHand(cards: string[] | undefined): boolean {
    return hasElements(cards) && cards.every(card => !isMaskedCard(card));
}

function playersBySeat(players: readonly PlayerDTO[]): Map<number, PlayerDTO> {
    const map = new Map<number, PlayerDTO>();
    for (const player of players) {
        map.set(player.seat, player);
    }
    return map;
}

/**
 * Derive the typed transitions between two consecutive snapshots.
 *
 * @throws {RegressedSnapshotError} when same-hand action indices regress.
 */
export function deriveEvents(prev: TexasHoldemStateDTO | undefined, next: TexasHoldemStateDTO): GameEvent[] {
    if (prev === undefined) {
        return [];
    }

    const handAdvanced = next.handNumber > prev.handNumber;
    const sameHand = next.handNumber === prev.handNumber;

    const prevMax = maxActionIndex(prev.previousActions);
    const nextMax = maxActionIndex(next.previousActions);

    if (sameHand && prevMax !== null && nextMax !== null && nextMax < prevMax) {
        throw new RegressedSnapshotError(prevMax, nextMax, next.handNumber);
    }

    const events: GameEvent[] = [];

    const prevSeats = playersBySeat(prev.players);
    const nextSeats = playersBySeat(next.players);
    for (const [seat, player] of nextSeats) {
        if (!prevSeats.has(seat)) {
            events.push({ type: "playerJoined", seat, address: player.address });
        }
    }
    for (const [seat, player] of prevSeats) {
        if (!nextSeats.has(seat)) {
            events.push({ type: "playerLeft", seat, address: player.address });
        }
    }

    if (handAdvanced) {
        events.push({ type: "handStarted", handNumber: next.handNumber });
    }

    const baseline = prevMax ?? -1;
    const newActions = next.previousActions.filter(action => action.index > baseline).sort((a, b) => a.index - b.index);
    for (const action of newActions) {
        events.push({ type: "playerActed", action });
    }

    if (sameHand && next.round !== prev.round && roundOrder(next.round) > roundOrder(prev.round)) {
        const newCommunityCards = next.communityCards.slice(prev.communityCards.length);
        events.push({ type: "roundAdvanced", from: prev.round, to: next.round, newCommunityCards });
    }

    for (const [seat, nextPlayer] of nextSeats) {
        const prevPlayer = prevSeats.get(seat);
        if (prevPlayer && isMaskedHand(prevPlayer.holeCards) && isRevealedHand(nextPlayer.holeCards)) {
            events.push({ type: "cardsRevealed", seat, cards: nextPlayer.holeCards as string[] });
        }
    }

    for (const [seat, nextPlayer] of nextSeats) {
        const prevPlayer = prevSeats.get(seat);
        if (prevPlayer && prevPlayer.stack !== nextPlayer.stack) {
            events.push({ type: "stackChanged", seat, from: prevPlayer.stack, to: nextPlayer.stack });
        }
    }

    if (hasElements(next.winners) && isEmpty(prev.winners)) {
        events.push({ type: "handEnded", winners: next.winners });
    }

    return events;
}
