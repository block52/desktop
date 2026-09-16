import { useCallback, useMemo } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { depositAbi, BRIDGE_ADDRESS } from "../../abis/contractABI";
import { ETH_CHAIN_ID } from "../../config/constants";

const useDepositUSDC = () => {
    const { data: hash, mutateAsync, isPending, error } = useWriteContract();

    const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
    // isSuccess only means a receipt was fetched, not that the transaction succeeded on-chain —
    // it stays true even for a reverted transaction. Require receipt.status === "success".
    const isConfirmed = isSuccess && receipt?.status === "success";

    // Deposit USDC directly - receiver is a Cosmos address string (e.g. "b521...")
    const deposit = useCallback(
        async (amount: bigint, cosmosReceiver: string): Promise<void> => {
            await mutateAsync({
                address: BRIDGE_ADDRESS as `0x${string}`,
                abi: depositAbi,
                functionName: "depositUnderlying",
                args: [amount, cosmosReceiver],
                chainId: ETH_CHAIN_ID,
            });
        },
        [mutateAsync]
    );

    // Deposit any ERC20 token - auto-swaps to USDC if not the underlying token
    const depositToken = useCallback(
        async (amount: bigint, cosmosReceiver: string, tokenAddress: string): Promise<void> => {
            await mutateAsync({
                address: BRIDGE_ADDRESS as `0x${string}`,
                abi: depositAbi,
                functionName: "deposit",
                args: [amount, cosmosReceiver, tokenAddress as `0x${string}`],
                chainId: ETH_CHAIN_ID,
            });
        },
        [mutateAsync]
    );

    return useMemo(
        () => ({
            deposit,
            depositToken,
            isDepositPending: isConfirming,
            isDepositConfirmed: isConfirmed,
            isPending,
            hash,
            depositError: error,
        }),
        [deposit, depositToken, isConfirming, isPending, isConfirmed, hash, error]
    );
};

export default useDepositUSDC;
