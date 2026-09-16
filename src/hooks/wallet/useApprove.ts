import { useCallback, useMemo } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { erc20abi } from "../../abis/erc20ABI";

const useApprove = () => {
    const { data: hash, isPending, mutateAsync, error } = useWriteContract();
    const { address: userAddress } = useAppKitAccount();

    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

    const approve = useCallback(
        async (tokenAddress: string, spender: string, amount: bigint): Promise<void> => {
            if (!userAddress) {
                throw new Error("Web3 wallet is not connected");
            }

            await mutateAsync({
                address: tokenAddress as `0x${string}`,
                abi: erc20abi,
                functionName: "approve",
                args: [spender as `0x${string}`, amount],
            });
        },
        [userAddress, mutateAsync]
    );

    return useMemo(
        () => ({
            approve,
            hash,
            isLoading: isPending,
            isApprovePending: isConfirming,
            isApproveConfirmed: isConfirmed,
            approveError: error,
        }),
        [approve, hash, isPending, isConfirming, isConfirmed, error]
    );
};

export default useApprove;
