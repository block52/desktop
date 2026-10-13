import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NetworkEndpoints } from "../../context/NetworkContext";

const { mockCreateSigningClientFromMnemonic, mockGetCosmosAddress, mockGetCosmosMnemonic } = vi.hoisted(() => ({
    mockCreateSigningClientFromMnemonic: vi.fn(),
    mockGetCosmosAddress: vi.fn(),
    mockGetCosmosMnemonic: vi.fn(),
}));

vi.mock("@block52/poker-vm-sdk", async () => {
    const actual = await vi.importActual<typeof import("@block52/poker-vm-sdk")>("@block52/poker-vm-sdk");
    return {
        ...actual,
        createSigningClientFromMnemonic: mockCreateSigningClientFromMnemonic,
    };
});

vi.mock("./storage", () => ({
    getCosmosAddress: mockGetCosmosAddress,
    getCosmosMnemonic: mockGetCosmosMnemonic,
}));

import {
    getSigningClient,
    clearSigningClientCache,
    isSequenceMismatchError,
    isTransportError,
    withMoneyMoverRetry,
    SEQUENCE_RETRY_DELAY_MS,
} from "./client";

const NETWORK_A: NetworkEndpoints = { name: "testnet-a", rpc: "http://rpc-a", rest: "http://rest-a", grpc: "http://grpc-a", ws: "ws://ws-a" };
const NETWORK_B: NetworkEndpoints = { name: "testnet-b", rpc: "http://rpc-b", rest: "http://rest-b", grpc: "http://grpc-b", ws: "ws://ws-b" };

function fakeSigningClient(): Record<string, unknown> {
    return { performActionSync: vi.fn(), joinGame: vi.fn(), leaveGame: vi.fn() };
}

function stubNodeNetwork(network: string): void {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ default_node_info: { network } }) }))
    );
}

beforeEach(() => stubNodeNetwork("pokerchain"));
afterEach(() => vi.unstubAllGlobals());

describe("getSigningClient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearSigningClientCache();
        mockGetCosmosAddress.mockReturnValue("b52addr1");
        mockGetCosmosMnemonic.mockReturnValue("test mnemonic words here");
        mockCreateSigningClientFromMnemonic.mockResolvedValue(fakeSigningClient());
    });

    it("derives the signing client only once across repeated calls in the same session", async () => {
        await getSigningClient(NETWORK_A);
        await getSigningClient(NETWORK_A);
        await getSigningClient(NETWORK_A);

        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(1);
    });

    it("refuses to sign for a node that serves a different network", async () => {
        stubNodeNetwork("some-other-chain");

        await expect(getSigningClient({ ...NETWORK_A, rest: "http://rest-wrong-chain" })).rejects.toThrow(/Refusing to sign/);
        expect(mockCreateSigningClientFromMnemonic).not.toHaveBeenCalled();
    });

    it("dedupes concurrent callers into a single in-flight derivation", async () => {
        const [a, b] = await Promise.all([getSigningClient(NETWORK_A), getSigningClient(NETWORK_A)]);

        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(1);
        expect(a).toBe(b);
    });

    it("rebuilds when the network endpoints change", async () => {
        await getSigningClient(NETWORK_A);
        await getSigningClient(NETWORK_B);

        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
    });

    it("rebuilds when the wallet address changes (wallet swap)", async () => {
        await getSigningClient(NETWORK_A);
        mockGetCosmosAddress.mockReturnValue("b52addr2");
        await getSigningClient(NETWORK_A);

        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
    });

    it("rebuilds after clearSigningClientCache()", async () => {
        await getSigningClient(NETWORK_A);
        clearSigningClientCache();
        await getSigningClient(NETWORK_A);

        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
    });

    it("drops the cache when derivation rejects so the next call retries", async () => {
        mockCreateSigningClientFromMnemonic.mockRejectedValueOnce(new Error("connection refused"));

        await expect(getSigningClient(NETWORK_A)).rejects.toThrow("connection refused");

        mockCreateSigningClientFromMnemonic.mockResolvedValueOnce(fakeSigningClient());
        await expect(getSigningClient(NETWORK_A)).resolves.toBeDefined();
        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
    });

    it("throws if the wallet is not initialized", async () => {
        mockGetCosmosMnemonic.mockReturnValue(null);

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
        vi.clearAllMocks();
        clearSigningClientCache();
        mockGetCosmosAddress.mockReturnValue("b52addr1");
        mockGetCosmosMnemonic.mockReturnValue("test mnemonic words here");
        mockCreateSigningClientFromMnemonic.mockResolvedValue(fakeSigningClient());
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("passes through successful results without rebuilding the client", async () => {
        const fn = vi.fn().mockResolvedValue("0xhash");

        const result = await withMoneyMoverRetry(NETWORK_A, fn);

        expect(result).toBe("0xhash");
        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(1);
    });

    it("retries once with a fresh client after a sequence mismatch, waiting for the pending tx to commit", async () => {
        const seqErr = new Error("account sequence mismatch, expected 2, got 1");
        const fn = vi.fn().mockRejectedValueOnce(seqErr).mockResolvedValueOnce("0xretry");

        const resultPromise = withMoneyMoverRetry(NETWORK_A, fn);
        await vi.advanceTimersByTimeAsync(SEQUENCE_RETRY_DELAY_MS);
        const result = await resultPromise;

        expect(result).toBe("0xretry");
        expect(fn).toHaveBeenCalledTimes(2);
        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
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
