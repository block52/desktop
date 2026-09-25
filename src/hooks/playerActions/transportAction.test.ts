import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NetworkEndpoints } from "../../context/NetworkContext";

const { mockGetSigningClient, mockClearSigningClientCache } = vi.hoisted(() => ({
    mockGetSigningClient: vi.fn(),
    mockClearSigningClientCache: vi.fn(),
}));

vi.mock("../../utils/cosmos/client", () => ({
    getSigningClient: mockGetSigningClient,
    clearSigningClientCache: mockClearSigningClientCache,
    isSequenceMismatchError: (err: unknown) =>
        /account sequence mismatch/i.test(err instanceof Error ? err.message : String(err ?? "")),
    SEQUENCE_RETRY_DELAY_MS: 0,
}));

import { executeTransportAction, isStaleIndexError, STALE_INDEX_MESSAGE } from "./transportAction";

const FAKE_NETWORK = { name: "testnet", rpc: "http://x", rest: "http://y", grpc: "http://z", ws: "ws://w" } as NetworkEndpoints;

function mockSigningClient(performActionSync: ReturnType<typeof vi.fn>): void {
    mockGetSigningClient.mockResolvedValue({ signingClient: { performActionSync }, userAddress: "b52test" });
}

describe("isStaleIndexError", () => {
    it("matches the chain's stale action-index rejection", () => {
        expect(isStaleIndexError(new Error("Invalid action index"))).toBe(true);
    });

    it("does not match unrelated errors", () => {
        expect(isStaleIndexError(new Error("insufficient funds"))).toBe(false);
    });
});

describe("executeTransportAction — stale-index rewrite", () => {
    beforeEach(() => vi.clearAllMocks());

    it("rewrites the chain's raw 'Invalid action index' into the retryable prompt", async () => {
        mockSigningClient(vi.fn().mockRejectedValue(new Error("Invalid action index")));

        await expect(executeTransportAction("game-1", "call", 0n, FAKE_NETWORK)).rejects.toThrow(STALE_INDEX_MESSAGE);
    });

    it("propagates every other chain error unchanged", async () => {
        mockSigningClient(vi.fn().mockRejectedValue(new Error("insufficient funds")));

        await expect(executeTransportAction("game-1", "call", 0n, FAKE_NETWORK)).rejects.toThrow("insufficient funds");
    });

    it("returns the tx result on success", async () => {
        mockSigningClient(vi.fn().mockResolvedValue("0xabc"));

        const result = await executeTransportAction("game-1", "bet", 100n, FAKE_NETWORK);

        expect(result).toEqual({ hash: "0xabc", gameId: "game-1", action: "bet", amount: "100" });
    });
});

describe("executeTransportAction — sequence-mismatch recovery", () => {
    beforeEach(() => vi.clearAllMocks());

    const SEQ_ERR = new Error(
        "Broadcasting transaction failed with code 32 (codespace: sdk). Log: account sequence mismatch, expected 510, got 509: incorrect account sequence"
    );

    it("clears the client cache and retries once, succeeding on the retry", async () => {
        const performActionSync = vi.fn().mockRejectedValueOnce(SEQ_ERR).mockResolvedValueOnce("0xretry");
        mockSigningClient(performActionSync);

        const result = await executeTransportAction("game-1", "sit-out", 0n, FAKE_NETWORK, "method=next-hand");

        expect(result).toEqual({ hash: "0xretry", gameId: "game-1", action: "sit-out", amount: "0" });
        expect(performActionSync).toHaveBeenCalledTimes(2);
        expect(mockClearSigningClientCache).toHaveBeenCalledTimes(1);
    });

    it("surfaces the error if the sequence mismatch persists after the retry", async () => {
        const performActionSync = vi.fn().mockRejectedValue(SEQ_ERR);
        mockSigningClient(performActionSync);

        await expect(
            executeTransportAction("game-1", "sit-out", 0n, FAKE_NETWORK, "method=next-hand")
        ).rejects.toThrow(/account sequence mismatch/);
        expect(performActionSync).toHaveBeenCalledTimes(2);
    });

    it("does not retry a non-sequence error", async () => {
        const performActionSync = vi.fn().mockRejectedValue(new Error("insufficient funds"));
        mockSigningClient(performActionSync);

        await expect(executeTransportAction("game-1", "sit-out", 0n, FAKE_NETWORK)).rejects.toThrow("insufficient funds");
        expect(performActionSync).toHaveBeenCalledTimes(1);
        expect(mockClearSigningClientCache).not.toHaveBeenCalled();
    });

    it("rewrites a stale-index error surfaced on the retry", async () => {
        const performActionSync = vi
            .fn()
            .mockRejectedValueOnce(SEQ_ERR)
            .mockRejectedValueOnce(new Error("Invalid action index"));
        mockSigningClient(performActionSync);

        await expect(
            executeTransportAction("game-1", "sit-out", 0n, FAKE_NETWORK, "method=next-hand")
        ).rejects.toThrow(STALE_INDEX_MESSAGE);
    });
});
