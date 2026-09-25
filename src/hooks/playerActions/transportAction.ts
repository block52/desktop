/**
 * Action executor — the single funnel every per-action helper (callHand,
 * foldHand, ...) routes through.
 *
 * Actions submit chain-direct via the SDK's performActionSync. The action
 * index is assigned by the chain at execution from committed state, so the
 * client never supplies one.
 */
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import {
    getSigningClient,
    isSequenceMismatchError,
    clearSigningClientCache,
    SEQUENCE_RETRY_DELAY_MS,
} from "../../utils/cosmos/client";

/**
 * The engine keys replay protection on the action index and rejects a
 * mismatch with "Invalid action index." This happens when ANOTHER player
 * acts between our state snapshot and our submit — a mid-hand join / sit-in
 * consumes indices — leaving ours stale.
 */
export function isStaleIndexError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    return /invalid action index/i.test(msg);
}

// User-facing, retryable message for the stale-index case. Deliberately NOT
// auto-retried (that can mask real problems / double-fire); instead this
// surfaces a clear prompt so the user re-submits, which recomputes the
// index from the state that has since advanced.
export const STALE_INDEX_MESSAGE = "Your turn advanced while you were acting — please try again.";

async function broadcastAction(
    tableId: string,
    action: string,
    amount: bigint,
    network: NetworkEndpoints,
    data?: string
): Promise<PlayerActionResult> {
    const { signingClient } = await getSigningClient(network);
    const transactionHash = await signingClient.performActionSync(tableId, action, amount, data);
    return {
        hash: transactionHash,
        gameId: tableId,
        action,
        amount: amount.toString(),
    };
}

export async function executeTransportAction(
    tableId: string,
    action: string,
    amount: bigint,
    network: NetworkEndpoints,
    data?: string
): Promise<PlayerActionResult> {
    try {
        return await broadcastAction(tableId, action, amount, network, data);
    } catch (err) {
        // Account sequence mismatch (Cosmos code 32): a prior tx from this
        // account is still pending in the mempool, so getSequence returned a
        // stale (already-consumed) value and this action signed a colliding
        // sequence. code-32 is a CheckTx rejection — the action was NOT
        // applied — so clear the cached client, wait a beat for the pending
        // tx to commit and bump the on-chain sequence, then retry once.
        if (isSequenceMismatchError(err)) {
            clearSigningClientCache();
            await new Promise(resolve => setTimeout(resolve, SEQUENCE_RETRY_DELAY_MS));
            try {
                return await broadcastAction(tableId, action, amount, network, data);
            } catch (retryErr) {
                if (isStaleIndexError(retryErr)) {
                    throw new Error(STALE_INDEX_MESSAGE);
                }
                throw retryErr;
            }
        }
        // Rewrite the raw "Invalid action index" into a clear, retryable
        // prompt. A rejected action was NOT applied, so re-submitting is
        // safe. Every other error propagates unchanged.
        if (isStaleIndexError(err)) {
            throw new Error(STALE_INDEX_MESSAGE);
        }
        throw err;
    }
}
