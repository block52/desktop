import { useEffect, useRef } from "react";
import { PlayerStatus, TexasHoldemRound, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";

const ROUNDS_THAT_DEAL_CARDS: ReadonlySet<TexasHoldemRound> = new Set([
    TexasHoldemRound.PREFLOP,
    TexasHoldemRound.FLOP,
    TexasHoldemRound.TURN,
    TexasHoldemRound.RIVER,
    TexasHoldemRound.SHOWDOWN
]);

const STATUSES_WITH_HOLE_CARDS: ReadonlySet<PlayerStatus> = new Set([PlayerStatus.ACTIVE, PlayerStatus.ALL_IN, PlayerStatus.SHOWING]);

const MAX_ATTEMPTS_PER_HAND = 2;
const GRACE_PERIOD_MS = 1500;

/**
 * Recovers from the feed losing the player's own hole cards (web issue #409): when the table says the player is
 * in a dealt hand but their cards are missing or incomplete, the subscription is out of sync, so it is torn down
 * and re-established. A short grace period lets a card message that is merely a tick behind arrive first, and at
 * most two attempts are made per hand so it can never loop.
 */
export function useHoleCardWatchdog(args: {
    gameState: TexasHoldemStateDTO | undefined;
    localAddress: string | null;
    resubscribe: () => void;
}): void {
    const { gameState, localAddress, resubscribe } = args;
    const attempts = useRef({ handNumber: -1, count: 0 });
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Always call the latest resubscribe without restarting the grace timer.
    const latestResubscribe = useRef(resubscribe);
    useEffect(() => {
        latestResubscribe.current = resubscribe;
    }, [resubscribe]);

    const handNumber = gameState?.handNumber;
    // A new frame re-arms the check, so a recovery that did not take can be retried (within the per-hand budget).
    const actionCount = gameState?.actionCount;
    const me =
        gameState !== undefined && localAddress !== null
            ? gameState.players.find(player => player.address.toLowerCase() === localAddress)
            : undefined;
    const isUnhealthy =
        gameState !== undefined &&
        ROUNDS_THAT_DEAL_CARDS.has(gameState.round) &&
        me !== undefined &&
        STATUSES_WITH_HOLE_CARDS.has(me.status) &&
        (me.holeCards === undefined || me.holeCards.length !== 2);

    useEffect(() => {
        if (!isUnhealthy || handNumber === undefined) return;
        if (attempts.current.handNumber !== handNumber) {
            attempts.current = { handNumber, count: 0 };
        }
        if (attempts.current.count >= MAX_ATTEMPTS_PER_HAND) return;

        timer.current = setTimeout(() => {
            timer.current = null;
            attempts.current.count += 1;
            latestResubscribe.current();
        }, GRACE_PERIOD_MS);

        return () => {
            if (timer.current !== null) {
                clearTimeout(timer.current);
                timer.current = null;
            }
        };
    }, [isUnhealthy, handNumber, actionCount]);
}
