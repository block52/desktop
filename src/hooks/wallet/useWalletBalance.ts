import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { erc20abi } from "../../abis/erc20ABI";
import { ETH_CHAIN_ID, ETH_USDC_ADDRESS } from "../../config/constants";

const useWalletBalance = (tokenAddress: string = ETH_USDC_ADDRESS) => {
    const { address } = useAppKitAccount();

    const { data: balance, isLoading, isError } = useReadContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20abi,
        chainId: ETH_CHAIN_ID,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
        query: { enabled: !!address },
    });

    return useMemo(() => ({ balance, isLoading, isError }), [balance, isLoading, isError]);
};

export default useWalletBalance;
