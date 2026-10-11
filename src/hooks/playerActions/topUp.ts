import type { NetworkEndpoints } from "../../context/NetworkContext";
import { withMoneyMoverRetry } from "../../utils/cosmos/client";

export interface TopUpResult {
    hash: string;
    gameId: string;
    amount: string;
}

/**
 * Add chips to the seat's stack between hands (MsgTopUp). The chain enforces that the player is not in the
 * hand and that stack + amount stays within the table's max buy-in; it applies at the next hand.
 *
 * @param amountMicro - USDC in micro units
 */
export async function topUpTable(tableId: string, network: NetworkEndpoints, amountMicro: bigint): Promise<TopUpResult> {
    if (amountMicro <= 0n) {
        throw new Error("Top-up amount must be greater than zero");
    }
    // An ordered money-mover: retry once on a sequence mismatch from a still-pending prior money-mover.
    const hash = await withMoneyMoverRetry(network, ({ signingClient }) => signingClient.topUp(tableId, amountMicro));
    return { hash, gameId: tableId, amount: amountMicro.toString() };
}
