import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { BRIDGE_ADDRESS, depositAbi } from "../abis/contractABI";
import { erc20abi } from "../abis/erc20ABI";
import { ETH_CHAIN_ID, ETH_USDC_ADDRESS, ETH_USDT_ADDRESS, ETH_WBTC_ADDRESS } from "../config/constants";
import type { EthChain } from "./ethWallet";

/** Ethereum mainnet over a JSON-RPC node, through ethers. */
export function createEthChain(rpcUrl: string): EthChain {
    const provider = new JsonRpcProvider(rpcUrl, ETH_CHAIN_ID, { staticNetwork: true });
    let verified: Promise<void> | null = null;

    // A node picks the chain a transaction is signed for, so check it really is mainnet before signing for it.
    const ensureMainnet = (): Promise<void> => {
        verified ??= provider.send("eth_chainId", []).then((id: string) => {
            if (BigInt(id) !== BigInt(ETH_CHAIN_ID)) throw new Error("The Ethereum node is not on mainnet. Refusing to sign.");
        });
        verified.catch(() => {
            verified = null;
        });
        return verified;
    };

    const token = (address: string, runner: Wallet | JsonRpcProvider = provider) => new Contract(address, erc20abi, runner);
    const bridge = (signer: Wallet) => new Contract(BRIDGE_ADDRESS, depositAbi, signer);

    const mined = async (send: Promise<{ wait: () => Promise<{ status: number | null; hash: string } | null> }>): Promise<string> => {
        const receipt = await (await send).wait();
        if (receipt === null || receipt.status !== 1) throw new Error("The Ethereum transaction failed.");
        return receipt.hash;
    };

    return {
        async balances(address) {
            const [eth, usdc, usdt, wbtc] = await Promise.all([
                provider.getBalance(address),
                token(ETH_USDC_ADDRESS).balanceOf(address) as Promise<bigint>,
                token(ETH_USDT_ADDRESS).balanceOf(address) as Promise<bigint>,
                token(ETH_WBTC_ADDRESS).balanceOf(address) as Promise<bigint>,
            ]);
            return { eth, usdc, usdt, wbtc };
        },
        allowance: async (tokenAddress, owner) => token(tokenAddress).allowance(owner, BRIDGE_ADDRESS) as Promise<bigint>,
        async approve(privateKey, tokenAddress, amount) {
            await ensureMainnet();
            return mined(token(tokenAddress, new Wallet(privateKey, provider)).approve(BRIDGE_ADDRESS, amount));
        },
        async depositUnderlying(privateKey, amount, cosmosReceiver) {
            await ensureMainnet();
            return mined(bridge(new Wallet(privateKey, provider)).depositUnderlying(amount, cosmosReceiver));
        },
        async depositToken(privateKey, amount, cosmosReceiver, tokenAddress) {
            await ensureMainnet();
            return mined(bridge(new Wallet(privateKey, provider)).deposit(amount, cosmosReceiver, tokenAddress));
        },
    };
}
