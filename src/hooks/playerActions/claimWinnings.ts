import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { getSigningClient, withMoneyMoverRetry } from "../../utils/cosmos/client";
import { finishingOrderFromState } from "../../utils/cosmos/settlementTx";

export interface ClaimWinningsResult {
    hash: string;
    gameId: string;
}

/**
 * A RecordHandEnd rejection is benign only when the chain already holds an equal-or-more-complete finished
 * state (another finisher recorded the results). Anything else means the results are NOT on-chain, so
 * settling would pay nothing while showing no error.
 */
export function resultsAlreadyOnChain(err: unknown): boolean {
    const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
    return message.includes("already finalized") || message.includes("stale");
}

/**
 * Claim a decided Sit & Go prize. Once a tournament starts the roster is frozen: finishers claim their
 * prize-pool payout instead of leaving. This records the finished hand on-chain so the chain has results to
 * pay from, then settles with MsgLeaveGame (the chain's SNG claim handler: looks up the caller's result,
 * transfers, marks claimed). Both are signed by the claimant's own account, directly to the chain.
 */
export async function claimWinnings(
    tableId: string,
    network: NetworkEndpoints,
    finalState: TexasHoldemStateDTO | undefined
): Promise<ClaimWinningsResult> {
    const { signingClient } = await getSigningClient(network);

    if (finalState !== undefined) {
        try {
            await signingClient.recordHandEnd(tableId, JSON.stringify(finalState));
        } catch (err) {
            if (!resultsAlreadyOnChain(err)) {
                const detail = err instanceof Error ? err.message : String(err);
                throw new Error(`Could not record the finished hand on-chain — the prize cannot be settled yet. ${detail}`);
            }
        }
    }

    // Retry once on a sequence mismatch: the record above may still be pending in the mempool.
    const hash = await withMoneyMoverRetry(network, ({ signingClient: client }) =>
        client.leaveGame(tableId, finishingOrderFromState(finalState))
    );
    return { hash, gameId: tableId };
}
