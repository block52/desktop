// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { WalletBridge } from "../../wallet/types";
import { useEthAccount } from "./useEthAccount";

const ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

afterEach(() => {
    window.electronAPI = undefined;
});

describe("useEthAccount", () => {
    it("loads the derived address and balances", async () => {
        const ethBalances = vi.fn(async () => ({ eth: 1n, usdc: 2n, usdt: 3n, wbtc: 4n }));
        window.electronAPI = { openExternal: vi.fn(), wallet: { ethAddress: vi.fn(async () => ADDRESS), ethBalances } as unknown as WalletBridge };
        const { result } = renderHook(() => useEthAccount());
        await waitFor(() => expect(result.current.balances).toEqual({ eth: 1n, usdc: 2n, usdt: 3n, wbtc: 4n }));
        expect(result.current.address).toBe(ADDRESS);
        expect(result.current.available).toBe(true);

        ethBalances.mockResolvedValueOnce({ eth: 0n, usdc: 9n, usdt: 0n, wbtc: 0n });
        await act(() => result.current.refresh());
        expect(result.current.balances?.usdc).toBe(9n);
    });

    it("keeps the reason when the wallet cannot be read", async () => {
        window.electronAPI = {
            openExternal: vi.fn(),
            wallet: {
                ethAddress: vi.fn(async () => ADDRESS),
                ethBalances: vi.fn(async () => Promise.reject(new Error("Error invoking remote method 'wallet:eth-balances': Error: node down")))
            } as unknown as WalletBridge
        };
        const { result } = renderHook(() => useEthAccount());
        await waitFor(() => expect(result.current.error).toBe("node down"));
        expect(result.current.balances).toBeNull();
    });

    it("is unavailable outside the desktop app", () => {
        const { result } = renderHook(() => useEthAccount());
        expect(result.current.available).toBe(false);
        expect(result.current.address).toBeNull();
    });
});
