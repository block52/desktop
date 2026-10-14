// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { WalletBridge } from "../../wallet/types";

const { mockGetCosmosAddress } = vi.hoisted(() => ({
    mockGetCosmosAddress: vi.fn(),
}));

vi.mock("./storage", () => ({
    getCosmosAddress: mockGetCosmosAddress,
}));

import {
    getSigningClient,
    isSequenceMismatchError,
    isTransportError,
    withMoneyMoverRetry,
    SEQUENCE_RETRY_DELAY_MS,
} from "./client";

const NETWORK_A: NetworkEndpoints = { name: "testnet-a", rpc: "http://rpc-a", rest: "http://rest-a", grpc: "http://grpc-a", ws: "ws://ws-a" };

const bridge = {
    signingCall: vi.fn(),
    resetSigner: vi.fn(async () => undefined),
};

beforeEach(() => {
    vi.clearAllMocks();
    mockGetCosmosAddress.mockReturnValue("b52addr1");
    window.electronAPI = { openExternal: vi.fn(), wallet: bridge as unknown as WalletBridge };
});

afterEach(() => {
    window.electronAPI = undefined;
});

describe("getSigningClient", () => {
    it("sends each signing call to the wallet with the network endpoints", async () => {
        bridge.signingCall.mockResolvedValue("0xhash");

        const { signingClient, userAddress } = await getSigningClient(NETWORK_A);
        const hash = await signingClient.joinGame("table-1", 3, 500n);

        expect(userAddress).toBe("b52addr1");
        expect(hash).toBe("0xhash");
        expect(bridge.signingCall).toHaveBeenCalledWith({ rpc: "http://rpc-a", rest: "http://rest-a" }, "joinGame", ["table-1", 3, 500n]);
    });

    it("exposes nothing that would hand out the key", async () => {
        const { signingClient } = await getSigningClient(NETWORK_A);

        expect("getWallet" in signingClient).toBe(false);
        expect("setWallet" in signingClient).toBe(false);
    });

    it("throws if the wallet is not initialized", async () => {
        mockGetCosmosAddress.mockReturnValue(null);

        await expect(getSigningClient(NETWORK_A)).rejects.toThrow("Block52 wallet not initialized");
    });
});

describe("isSequenceMismatchError", () => {
    it("matches the SDK account-sequence-mismatch broadcast error", () => {
        const err = new Error(
            "Broadcasting transaction failed with code 32 (codespace: sdk). Log: account sequence mismatch, expected 510, got 509"
        );
        expect(isSequenceMismatchError(err)).toBe(true);
    });

    it("is case-insensitive and works on plain strings", () => {
        expect(isSequenceMismatchError("ACCOUNT SEQUENCE MISMATCH")).toBe(true);
    });

    it("does not match unrelated errors", () => {
        expect(isSequenceMismatchError(new Error("insufficient funds"))).toBe(false);
    });
});

describe("isTransportError", () => {
    it("matches a network-shaped error message", () => {
        expect(isTransportError(new Error("Network request failed"))).toBe(true);
    });

    it("does not match an application-level rejection", () => {
        expect(isTransportError(new Error("insufficient funds"))).toBe(false);
    });

    it("does not match a non-object value", () => {
        expect(isTransportError("plain string")).toBe(false);
    });
});

describe("withMoneyMoverRetry", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("passes through successful results without rebuilding the client", async () => {
        const fn = vi.fn().mockResolvedValue("0xhash");

        const result = await withMoneyMoverRetry(NETWORK_A, fn);

        expect(result).toBe("0xhash");
        expect(bridge.resetSigner).not.toHaveBeenCalled();
    });

    it("retries once with a fresh client after a sequence mismatch, waiting for the pending tx to commit", async () => {
        const seqErr = new Error("account sequence mismatch, expected 2, got 1");
        const fn = vi.fn().mockRejectedValueOnce(seqErr).mockResolvedValueOnce("0xretry");

        const resultPromise = withMoneyMoverRetry(NETWORK_A, fn);
        await vi.advanceTimersByTimeAsync(SEQUENCE_RETRY_DELAY_MS);
        const result = await resultPromise;

        expect(result).toBe("0xretry");
        expect(fn).toHaveBeenCalledTimes(2);
        expect(bridge.resetSigner).toHaveBeenCalledTimes(1);
    });

    it("retries once on transport errors without waiting", async () => {
        const fn = vi.fn().mockRejectedValueOnce(new Error("network request failed")).mockResolvedValueOnce("0xretry");

        const result = await withMoneyMoverRetry(NETWORK_A, fn);

        expect(result).toBe("0xretry");
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("does NOT retry unrelated application errors", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("insufficient funds"));

        await expect(withMoneyMoverRetry(NETWORK_A, fn)).rejects.toThrow("insufficient funds");
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("surfaces the error if the retry also fails (a persistently wedged sequence)", async () => {
        const seqErr = new Error("account sequence mismatch, expected 3, got 1");
        const fn = vi.fn().mockRejectedValue(seqErr);

        const resultPromise = withMoneyMoverRetry(NETWORK_A, fn).catch((e: unknown) => e);
        await vi.advanceTimersByTimeAsync(SEQUENCE_RETRY_DELAY_MS);
        const result = await resultPromise;

        expect(result).toBeInstanceOf(Error);
        expect(fn).toHaveBeenCalledTimes(2);
    });
});
