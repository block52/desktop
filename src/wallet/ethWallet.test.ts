import { describe, expect, it, vi } from "vitest";
import { EthWallet } from "./ethWallet";
import type { EthChain } from "./ethWallet";
import { ETH_USDC_ADDRESS, ETH_USDT_ADDRESS } from "../config/constants";

// A throwaway test phrase. Its first Ethereum account is the well-known Hardhat test account.
const MNEMONIC = "test test test test test test test test test test test junk";
const HARDHAT_ACCOUNT_0 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const COSMOS = "b52myownaddress";

function setup(options: { usdc?: bigint; usdt?: bigint; eth?: bigint; allowance?: bigint; confirm?: boolean; mnemonic?: string | null } = {}) {
    const calls: string[] = [];
    const chain: EthChain = {
        balances: vi.fn(async () => ({ eth: options.eth ?? 10n ** 16n, usdc: options.usdc ?? 50_000_000n, usdt: options.usdt ?? 50_000_000n, wbtc: 0n })),
        allowance: vi.fn(async () => options.allowance ?? 0n),
        approve: vi.fn(async (_key, token, amount) => {
            calls.push(`approve ${token === ETH_USDC_ADDRESS ? "USDC" : "USDT"} ${amount}`);
            return `0xapprove${calls.length}`;
        }),
        depositUnderlying: vi.fn(async (_key, amount, receiver) => {
            calls.push(`depositUnderlying ${amount} ${receiver}`);
            return "0xdeposit";
        }),
        depositToken: vi.fn(async (_key, amount, receiver, token) => {
            calls.push(`depositToken ${amount} ${receiver} ${token}`);
            return "0xdeposit";
        }),
    };
    const confirm = vi.fn(async () => options.confirm ?? true);
    const wallet = new EthWallet({
        readMnemonic: async () => (options.mnemonic === undefined ? MNEMONIC : options.mnemonic),
        confirm,
        chain,
        cosmosAddress: async () => COSMOS,
    });
    return { wallet, chain, confirm, calls };
}

describe("EthWallet", () => {
    it("derives the standard Ethereum account from the seed phrase", async () => {
        expect(await setup().wallet.address()).toBe(HARDHAT_ACCOUNT_0);
    });

    it("refuses while the wallet has no seed (locked or missing)", async () => {
        await expect(setup({ mnemonic: null }).wallet.address()).rejects.toThrow(/not initialized/);
    });

    it("approves, then deposits USDC straight in, to the wallet's own Block52 address", async () => {
        const { wallet, calls, confirm } = setup();
        const result = await wallet.deposit("USDC", 20_000_000n);
        expect(calls).toEqual(["approve USDC 20000000", `depositUnderlying 20000000 ${COSMOS}`]);
        expect(result).toEqual({ approveHash: "0xapprove1", depositHash: "0xdeposit" });
        expect(confirm).toHaveBeenCalledOnce();
        const [, detail] = confirm.mock.calls[0] as unknown as [string, string];
        expect(detail).toContain(HARDHAT_ACCOUNT_0);
        expect(detail).toContain(COSMOS);
        expect(detail).toContain("20 USDC");
    });

    it("skips the approval when the bridge already has enough allowance", async () => {
        const { wallet, calls } = setup({ allowance: 100_000_000n });
        const result = await wallet.deposit("USDC", 20_000_000n);
        expect(calls).toEqual([`depositUnderlying 20000000 ${COSMOS}`]);
        expect(result.approveHash).toBeNull();
    });

    it("deposits USDT through the bridge's swap call, clearing a stale allowance first", async () => {
        const { wallet, calls } = setup({ allowance: 1_000_000n });
        await wallet.deposit("USDT", 20_000_000n);
        expect(calls).toEqual(["approve USDT 0", "approve USDT 20000000", `depositToken 20000000 ${COSMOS} ${ETH_USDT_ADDRESS}`]);
    });

    it("sends nothing when the user cancels the confirmation", async () => {
        const { wallet, chain } = setup({ confirm: false });
        await expect(wallet.deposit("USDC", 1_000_000n)).rejects.toThrow("Cancelled");
        expect(chain.approve).not.toHaveBeenCalled();
        expect(chain.depositUnderlying).not.toHaveBeenCalled();
    });

    it("refuses more than the address holds, no gas, a bad token or a bad amount, before asking", async () => {
        await expect(setup({ usdc: 5_000_000n }).wallet.deposit("USDC", 6_000_000n)).rejects.toThrow(/not enough USDC/);
        await expect(setup({ eth: 0n }).wallet.deposit("USDC", 1_000_000n)).rejects.toThrow(/no ETH/);
        const { wallet, confirm } = setup();
        await expect(wallet.deposit("wBTC", 1n)).rejects.toThrow(/cannot be deposited/);
        await expect(wallet.deposit("USDC", 0n)).rejects.toThrow(/amount/);
        await expect(wallet.deposit("USDC", 5)).rejects.toThrow(/amount/);
        expect(confirm).not.toHaveBeenCalled();
    });
});
