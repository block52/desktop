// @vitest-environment jsdom
import { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { normalizeWithdrawal, useWithdrawalActivity } from "./useWithdrawalActivity";
import { getCosmosClient } from "../utils/cosmos/client";
import { useNetwork } from "../context/NetworkContext";

vi.mock("../utils/cosmos/client", () => ({ getCosmosClient: vi.fn() }));
vi.mock("../context/NetworkContext", () => ({ useNetwork: vi.fn() }));

const mockedGetCosmosClient = vi.mocked(getCosmosClient);
const mockedUseNetwork = vi.mocked(useNetwork);

const wrapper = ({ children }: { children: ReactNode }) => <>{children}</>;

function mockClient(withdrawals: unknown[]) {
    mockedUseNetwork.mockReturnValue({ currentNetwork: { name: "t", rpc: "r", rest: "e" } } as never);
    mockedGetCosmosClient.mockReturnValue({ listWithdrawalRequests: vi.fn().mockResolvedValue(withdrawals) } as never);
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("normalizeWithdrawal", () => {
    it("maps a signed request", () => {
        expect(normalizeWithdrawal({ nonce: "n1", base_address: "0xABC", amount: "5000000", status: "signed", created_at: 1700000000 })).toEqual({
            nonce: "n1", toAddress: "0xABC", amountMicro: "5000000", status: "signed", createdAt: 1700000000
        });
    });

    it("maps completed/claimed statuses to completed", () => {
        for (const s of ["completed", "claimed"]) {
            expect(normalizeWithdrawal({ nonce: "n", base_address: "0xA", amount: "1", status: s })?.status).toBe("completed");
        }
    });

    it("maps any other status to pending", () => {
        expect(normalizeWithdrawal({ nonce: "n", base_address: "0xA", amount: "1", status: "pending" })?.status).toBe("pending");
        expect(normalizeWithdrawal({ nonce: "n", base_address: "0xA", amount: "1" })?.status).toBe("pending");
    });

    it("returns null for malformed entries", () => {
        expect(normalizeWithdrawal(null)).toBeNull();
        expect(normalizeWithdrawal({})).toBeNull();
        expect(normalizeWithdrawal({ nonce: "n" })).toBeNull();
    });

    it("accepts string or number created_at, else null", () => {
        expect(normalizeWithdrawal({ nonce: "n", base_address: "0xA", amount: "1", created_at: "1700000000" })?.createdAt).toBe(1700000000);
        expect(normalizeWithdrawal({ nonce: "n", base_address: "0xA", amount: "1" })?.createdAt).toBeNull();
    });
});

describe("useWithdrawalActivity", () => {
    it("returns normalized items newest-first", async () => {
        mockClient([
            { nonce: "old", base_address: "0xA", amount: "1", status: "completed", created_at: 100 },
            { nonce: "new", base_address: "0xB", amount: "2", status: "pending", created_at: 200 }
        ]);
        const { result } = renderHook(() => useWithdrawalActivity("b52addr"), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.items.map(i => i.nonce)).toEqual(["new", "old"]);
        expect(result.current.error).toBe("");
    });

    it("sets error when the client call rejects", async () => {
        mockedUseNetwork.mockReturnValue({ currentNetwork: { name: "t", rpc: "r", rest: "e" } } as never);
        mockedGetCosmosClient.mockReturnValue({ listWithdrawalRequests: vi.fn().mockRejectedValue(new Error("boom")) } as never);
        const { result } = renderHook(() => useWithdrawalActivity("b52addr"), { wrapper });
        await waitFor(() => expect(result.current.error).toBe("boom"));
    });

    it("does nothing when address is null", () => {
        const { result } = renderHook(() => useWithdrawalActivity(null), { wrapper });
        expect(result.current.items).toEqual([]);
        expect(result.current.isLoading).toBe(false);
        expect(mockedGetCosmosClient).not.toHaveBeenCalled();
    });
});
