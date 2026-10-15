import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { useNetwork } from "../context/NetworkContext";
import { withdrawAbi, BRIDGE_ADDRESS } from "../abis/contractABI";
import { ETH_CHAIN_ID } from "../config/constants";
import { fetchWithdrawalSignature } from "../utils/withdrawalSignature";
import type { WithdrawalActivityItem } from "./useWithdrawalActivity";

/** A nonce, once paid out, stays paid out: remembered for the session so it is asked only once. */
const paidOut = new Set<string>();

function isNonceUsed(error: unknown): boolean {
    const text = error instanceof Error ? `${error.message} ${(error as { details?: string }).details ?? ""}` : String(error);
    return /nonce already used/i.test(text);
}

/**
 * The chain never learns that a withdrawal was paid out on Ethereum, so its request stays "pending". The bridge
 * contract does know: a dry run of the withdrawal reverts with "nonce already used". This asks that question for
 * each open withdrawal and returns the nonces that are already paid.
 */
export function usePaidOutWithdrawals(items: WithdrawalActivityItem[], refreshToken: number): Set<string> {
    const { currentNetwork } = useNetwork();
    const client = usePublicClient({ chainId: ETH_CHAIN_ID });
    const [found, setFound] = useState<Set<string>>(() => new Set(paidOut));

    const open = items.filter(item => item.status !== "completed");
    const key = open.map(item => item.nonce).join(",");

    useEffect(() => {
        if (client === undefined || open.length === 0) return;
        let cancelled = false;

        const check = async () => {
            for (const item of open) {
                if (paidOut.has(item.nonce)) continue;
                try {
                    const signature =
                        item.signature !== null
                            ? undefined
                            : await fetchWithdrawalSignature(currentNetwork.rest, { nonce: item.nonce, baseAddress: item.toAddress, amount: item.amountMicro });
                    if (signature === undefined) continue;
                    await client.simulateContract({
                        address: BRIDGE_ADDRESS as `0x${string}`,
                        abi: withdrawAbi,
                        functionName: "withdraw",
                        args: [BigInt(item.amountMicro), item.toAddress as `0x${string}`, item.nonce as `0x${string}`, signature as `0x${string}`],
                        account: item.toAddress as `0x${string}`
                    });
                } catch (error) {
                    if (isNonceUsed(error)) paidOut.add(item.nonce);
                }
            }
            if (!cancelled) setFound(new Set(paidOut));
        };

        void check();
        return () => {
            cancelled = true;
        };
        // `open` is derived from `key`, so the nonce list is what decides when to ask again
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, key, refreshToken, currentNetwork.rest]);

    return found;
}
