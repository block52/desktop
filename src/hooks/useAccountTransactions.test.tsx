// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { normalizeAccountTx, useAccountTransactions } from "./useAccountTransactions";
import { useNetwork } from "../context/NetworkContext";

vi.mock("../context/NetworkContext", () => ({ useNetwork: vi.fn() }));

const mockedUseNetwork = vi.mocked(useNetwork);

const TX = (hash: string, height: string, over: Record<string, unknown> = {}) => ({
    txhash: hash,
    height,
    timestamp: "2026-10-10T00:00:00Z",
    code: 0,
    ...over
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

describe("normalizeAccountTx", () => {
    it("maps a tx response to the account tx shape", () => {
        expect(normalizeAccountTx(TX("ABC", "100"))).toEqual({
            hash: "ABC",
            height: "100",
            timestamp: "2026-10-10T00:00:00Z",
            success: true
        });
        expect(normalizeAccountTx(TX("DEF", "100", { code: 4 }))?.success).toBe(false);
    });

    it("returns null without a hash or height", () => {
        expect(normalizeAccountTx({})).toBeNull();
        expect(normalizeAccountTx({ txhash: "A" })).toBeNull();
    });
});

describe("useAccountTransactions", () => {
    function mockFetch(withRecipient: unknown[] = []) {
        vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
            if (url.includes("message.sender")) {
                return { ok: true, json: async () => ({ tx_responses: [TX("S1", "101"), TX("SHARED", "100")] }) };
            }
            if (url.includes("transfer.recipient")) {
                return { ok: true, json: async () => ({ tx_responses: withRecipient }) };
            }
            throw new Error(`unexpected url: ${url}`);
        }));
    }

    it("merges sender and recipient txs, deduped by hash, newest first", async () => {
        mockedUseNetwork.mockReturnValue({ currentNetwork: { name: "t", rpc: "r", rest: "https://node.example.com" } } as never);
        mockFetch([TX("R1", "103"), TX("SHARED", "100")]);

        const { result } = renderHook(() => useAccountTransactions("b52addr"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.error).toBe("");
        expect(result.current.txs.map(t => t.hash)).toEqual(["R1", "S1", "SHARED"]);
    });

    it("stays idle when no address is selected", () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const { result } = renderHook(() => useAccountTransactions(null));
        expect(result.current.txs).toEqual([]);
        expect(result.current.isLoading).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sets an error when both queries fail", async () => {
        mockedUseNetwork.mockReturnValue({ currentNetwork: { name: "t", rpc: "r", rest: "https://node.example.com" } } as never);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 501 }));
        const { result } = renderHook(() => useAccountTransactions("b52addr"));
        await waitFor(() => expect(result.current.error).not.toBe(""));
        expect(result.current.txs).toEqual([]);
    });
});
