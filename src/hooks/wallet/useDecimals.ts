import { useState, useEffect } from "react";
import { useReadContract } from "wagmi";
import { erc20abi } from "../../abis/erc20ABI";
import { ETH_CHAIN_ID } from "../../config/constants";

const useDecimals = (tokenAddress: string) => {
    // Initialize to 6 (USDC standard) as fallback while loading
    const [decimals, setDecimals] = useState<number>(6);

    const { data, error, isLoading } = useReadContract({
        address: tokenAddress as `0x${string}`,
        functionName: "decimals",
        abi: erc20abi,
        chainId: ETH_CHAIN_ID,
    });

    useEffect(() => {
        if (data !== undefined) {
            setDecimals(data);
        }
    }, [data]);

    return { decimals, isLoading, error };
};

export default useDecimals;
