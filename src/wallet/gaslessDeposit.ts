import { AbiCoder, HDNodeWallet, ZeroAddress, getAddress, hexlify, keccak256, randomBytes } from "ethers";
import type { TypedDataField } from "ethers";
import { ETH_CHAIN_ID, ETH_USDC_ADDRESS } from "../config/constants";

/**
 * A USDC deposit paid for by someone else. The user signs an EIP-3009 `ReceiveWithAuthorization`, which moves USDC
 * and costs no ETH to sign. A relayer submits it and pays the network fee.
 *
 * The signed nonce is `keccak256(abi.encode(receiver, salt))`, so the signature also commits to the Block52 address
 * that gets credited: the relayer (or anyone who sees the request) cannot send the same authorization with a
 * different receiver.
 */

/** Authorizations are short-lived, so a signature that is never submitted cannot be used later. */
export const AUTHORIZATION_LIFETIME_SECONDS = 10 * 60;

/** The USDC token's EIP-712 domain on Ethereum mainnet. */
export const USDC_DOMAIN = {
    name: "USD Coin",
    version: "2",
    chainId: ETH_CHAIN_ID,
    verifyingContract: ETH_USDC_ADDRESS,
} as const;

export const RECEIVE_WITH_AUTHORIZATION_TYPES: Record<string, TypedDataField[]> = {
    ReceiveWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
    ],
};

/** A Block52 address: 42 characters, "b521" then bech32 characters. */
const BLOCK52_ADDRESS = /^b521[02-9ac-hj-np-z]{38}$/;

export function isBlock52Address(value: string): boolean {
    return BLOCK52_ADDRESS.test(value);
}

/** What the relayer needs to submit the deposit. All strings, so it goes over JSON as is. */
export interface GaslessDepositRequest {
    from: string;
    value: string;
    validAfter: string;
    validBefore: string;
    salt: string;
    receiver: string;
    signature: string;
}

export interface GaslessDepositInput {
    /** The Ethereum account that holds the USDC and signs. */
    account: HDNodeWallet;
    /** The deposit contract that receives the USDC. */
    depositor: string;
    /** USDC, 6 decimals. */
    value: bigint;
    /** This wallet's own Block52 address. */
    receiver: string;
    /** Seconds since the epoch; injected so tests are exact. */
    now: number;
    /** 32 random bytes as 0x hex; injected so tests are exact. Defaults to fresh randomness. */
    salt?: string;
}

export function nonceFor(receiver: string, salt: string): string {
    return keccak256(AbiCoder.defaultAbiCoder().encode(["string", "bytes32"], [receiver, salt]));
}

export async function signGaslessDeposit(input: GaslessDepositInput): Promise<GaslessDepositRequest> {
    const { account, value, receiver, now } = input;
    if (value <= 0n) throw new Error("Enter an amount to deposit.");
    if (!isBlock52Address(receiver)) throw new Error("The Block52 address is not valid for a deposit.");
    const depositor = getAddress(input.depositor);
    if (depositor === ZeroAddress) throw new Error("Gasless deposits are not configured.");

    const salt = input.salt ?? hexlify(randomBytes(32));
    const validAfter = 0n;
    const validBefore = BigInt(now + AUTHORIZATION_LIFETIME_SECONDS);
    const signature = await account.signTypedData(USDC_DOMAIN, RECEIVE_WITH_AUTHORIZATION_TYPES, {
        from: account.address,
        to: depositor,
        value,
        validAfter,
        validBefore,
        nonce: nonceFor(receiver, salt),
    });
    return {
        from: account.address,
        value: value.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        salt,
        receiver,
        signature,
    };
}
