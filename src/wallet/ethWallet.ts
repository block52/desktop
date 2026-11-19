import { HDNodeWallet } from "ethers";
import { ETH_USDC_ADDRESS, ETH_USDT_ADDRESS } from "../config/constants";
import { formatUnits } from "../config/ethTokens";
import { ETH_DEPOSIT_TOKENS } from "./types";
import type { EthBalances, EthDepositResult, EthDepositToken } from "./types";

/** The standard Ethereum path, so the same seed phrase gives the same address in any Ethereum wallet. */
const ETH_HD_PATH = "m/44'/60'/0'/0/0";

const TOKEN_CONTRACTS: Record<EthDepositToken, string> = { USDC: ETH_USDC_ADDRESS, USDT: ETH_USDT_ADDRESS };

/** The Ethereum side, injected so the wallet can be tested without a node. Writes wait for the transaction to be mined and throw if it reverts. */
export interface EthChain {
    balances: (address: string) => Promise<EthBalances>;
    /** How much of `token` the bridge may take from `owner`. */
    allowance: (token: string, owner: string) => Promise<bigint>;
    approve: (privateKey: string, token: string, amount: bigint) => Promise<string>;
    /** The bridge's depositUnderlying: USDC straight in. */
    depositUnderlying: (privateKey: string, amount: bigint, cosmosReceiver: string) => Promise<string>;
    /** The bridge's deposit: another token, which the bridge swaps to USDC. */
    depositToken: (privateKey: string, amount: bigint, cosmosReceiver: string, token: string) => Promise<string>;
}

interface EthWalletDeps {
    /** Returns the decrypted seed phrase, or throws while the wallet is locked. */
    readMnemonic: () => Promise<string | null>;
    confirm: (title: string, detail: string) => Promise<boolean>;
    chain: EthChain;
    /** This wallet's own Block52 address. The bridge mints to it, never to an address the page supplies. */
    cosmosAddress: () => Promise<string>;
}

function isDepositToken(value: unknown): value is EthDepositToken {
    return typeof value === "string" && (ETH_DEPOSIT_TOKENS as readonly string[]).includes(value);
}

/**
 * An Ethereum account derived from the wallet's seed phrase, kept in the main process like the Block52 signer: the
 * page only ever sees the address and balances, and asks for a deposit, which is confirmed in a native dialog.
 */
export class EthWallet {
    private readonly deps: EthWalletDeps;

    constructor(deps: EthWalletDeps) {
        this.deps = deps;
    }

    async address(): Promise<string> {
        return (await this.account()).address;
    }

    async balances(): Promise<EthBalances> {
        return this.deps.chain.balances(await this.address());
    }

    /** Sends the bridge's deposit from this address to this wallet's own Block52 address, approving it first if needed. */
    async deposit(token: unknown, amount: unknown): Promise<EthDepositResult> {
        if (!isDepositToken(token)) throw new Error("That token cannot be deposited.");
        if (typeof amount !== "bigint" || amount <= 0n) throw new Error("Enter an amount to deposit.");
        const { chain } = this.deps;
        const account = await this.account();
        const contract = TOKEN_CONTRACTS[token];

        const held = await chain.balances(account.address);
        if (amount > (token === "USDC" ? held.usdc : held.usdt)) throw new Error(`There is not enough ${token} on this address.`);
        if (held.eth === 0n) throw new Error("This address has no ETH to pay the network fee. Send a little ETH to it first.");

        const receiver = await this.deps.cosmosAddress();
        const confirmed = await this.deps.confirm(
            "Deposit to Block52?",
            `Deposit ${formatUnits(amount, 6)} ${token} from the Ethereum address\n${account.address}\nto your Block52 address\n${receiver}`,
        );
        if (!confirmed) throw new Error("Cancelled.");

        let approveHash: string | null = null;
        const allowance = await chain.allowance(contract, account.address);
        if (allowance < amount) {
            // USDT refuses to change an allowance from one non-zero value to another, so clear a stale one first.
            if (allowance > 0n && token === "USDT") await chain.approve(account.privateKey, contract, 0n);
            approveHash = await chain.approve(account.privateKey, contract, amount);
        }
        const depositHash =
            token === "USDC"
                ? await chain.depositUnderlying(account.privateKey, amount, receiver)
                : await chain.depositToken(account.privateKey, amount, receiver, contract);
        return { approveHash, depositHash };
    }

    private async account(): Promise<HDNodeWallet> {
        const mnemonic = await this.deps.readMnemonic();
        if (mnemonic === null) throw new Error("Block52 wallet not initialized. Please create or import a Block52 wallet first.");
        return HDNodeWallet.fromPhrase(mnemonic, undefined, ETH_HD_PATH);
    }
}
