import { COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { BroadcastActionParams } from "../../wallet/types";
import { requireWalletBridge } from "../../utils/cosmos/walletBridge";

/**
 * Game-action signing via the Go sidecar (pokerchain-go-client) instead of the
 * TypeScript SDK. Opt-in behind VITE_GO_SIGNER so the SDK stays the default
 * until the Go path is validated against a real node (see desktop #30, #37).
 *
 * Amounts are passed to Go as micro-USDC numbers; micro values are well within
 * JS safe-integer range, so the bigint→number narrowing is lossless here.
 */
export function goSignerEnabled(): boolean {
    return import.meta.env.VITE_GO_SIGNER === "true";
}

function microToNumber(micro: bigint): number {
    if (micro > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("goSigner: amount exceeds the safe range");
    }
    return Number(micro);
}

/** Signs + broadcasts one game action in Go, returning the tx hash. */
export async function goBroadcast(
    network: NetworkEndpoints,
    params:
        | { kind: "action"; gameId: string; action: string; amount: bigint; data?: string }
        | { kind: "join"; gameId: string; seat: number; buyIn: bigint }
        | { kind: "leave"; gameId: string }
        | { kind: "topUp"; gameId: string; amount: bigint }
): Promise<string> {
    const bridge = requireWalletBridge();
    const payload: BroadcastActionParams =
        params.kind === "action"
            ? { kind: "action", gameId: params.gameId, action: params.action, amount: microToNumber(params.amount), data: params.data }
            : params.kind === "join"
              ? { kind: "join", gameId: params.gameId, seat: params.seat, buyIn: microToNumber(params.buyIn) }
              : params.kind === "topUp"
                ? { kind: "topUp", gameId: params.gameId, amount: microToNumber(params.amount) }
                : { kind: "leave", gameId: params.gameId };

    const result = await bridge.broadcastAction(network.grpc, COSMOS_CONSTANTS.CHAIN_ID, payload);
    return result.txHash;
}
