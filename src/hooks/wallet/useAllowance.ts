import { useReadContract } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { erc20abi } from "../../abis/erc20ABI";
import { ETH_CHAIN_ID, ETH_USDC_ADDRESS } from "../../config/constants";
import { BRIDGE_ADDRESS } from "../../abis/contractABI";

const useAllowance = (tokenAddress: string = ETH_USDC_ADDRESS) => {
    const { address } = useAppKitAccount();

    const { data: allowance } = useReadContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20abi,
        chainId: ETH_CHAIN_ID,
        functionName: "allowance",
        args: [address as `0x${string}`, BRIDGE_ADDRESS as `0x${string}`],
        query: { enabled: !!address },
    });

    return { allowance };
};

export default useAllowance;
