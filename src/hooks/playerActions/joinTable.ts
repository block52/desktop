import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { JoinTableResult } from "../../types";
import type { JoinTableOptions } from "./types";
import { withMoneyMoverRetry } from "../../utils/cosmos/client";
import { parseUsdcToMicro } from "../../utils/currency";
import { hasValue, isNullish } from "../../utils/guards";

/**
 * Resolves the concrete seat a join should claim.
 *
 * "Random seat" used to be expressed as seat 0 ("let the server pick"), but
 * the engine's Sit-and-Go / tournament JOIN does NOT treat 0 as random — it
 * seats the player literally at 0, the "not-seated" sentinel (chain seats
 * are 1-indexed), so the join lands broken. When no seat is requested we
 * therefore pick a real empty seat from the latest broadcast state instead
 * of sending 0.
 */
export function resolveJoinSeat(requestedSeat: number | undefined, gameState: TexasHoldemStateDTO | undefined): number {
    if (hasValue(requestedSeat) && requestedSeat > 0) {
        return requestedSeat;
    }

    const maxPlayers = gameState?.gameOptions?.maxPlayers;
    if (isNullish(maxPlayers)) {
        throw new Error("Cannot resolve a seat to join — game state not loaded yet");
    }

    const occupied = new Set((gameState?.players ?? []).map(p => p.seat));
    for (let seat = 1; seat <= maxPlayers; seat++) {
        if (!occupied.has(seat)) {
            return seat;
        }
    }
    throw new Error("No available seats to join");
}

/**
 * Joins a poker table.
 *
 * `getLatestSnapshot` is supplied by the caller (via `useGameState()`) rather
 * than read from a module-level global — see GameStateContext's accessor.
 *
 * @param tableId - The ID of the table to join (game ID on Cosmos).
 * @param options - Buy-in amount (decimal USDC text) and an optional seat number.
 * @param network - The current network configuration from NetworkContext.
 * @param getLatestSnapshot - Returns the most recently ingested game-state snapshot.
 * @returns The transaction result including hash, gameId, seat, and buyInAmount.
 * @throws If the table ID is not provided or if an error occurs during the join operation.
 */
export async function joinTable(
    tableId: string,
    options: JoinTableOptions,
    network: NetworkEndpoints,
    getLatestSnapshot: () => TexasHoldemStateDTO | undefined
): Promise<JoinTableResult> {
    if (!tableId) {
        throw new Error("Table ID is required to join a table");
    }

    // Convert buy-in amount from USDC to micro-USDC (b52usdc). Parsed directly
    // from text — never routed through a float — so it can't be short by a
    // micro-unit on an ordinary cent amount.
    const buyInAmount = parseUsdcToMicro(options.amount);

    // Resolve a real seat — never the broken seat-0 "random" sentinel.
    const seat = resolveJoinSeat(options.seatNumber, getLatestSnapshot());

    // Broadcast MsgJoinGame chain-direct. JOIN is an ordered money-mover (it
    // carries the account sequence), so retry once on a sequence mismatch
    // caused by a still-pending prior money-mover — otherwise a wedged
    // sequence blocks every join.
    const transactionHash = await withMoneyMoverRetry(network, ({ signingClient }) => signingClient.joinGame(tableId, seat, buyInAmount));

    return {
        hash: transactionHash,
        gameId: tableId,
        seat,
        buyInAmount: buyInAmount.toString(),
    };
}
