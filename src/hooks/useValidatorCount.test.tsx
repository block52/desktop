// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useValidatorCount } from "./useValidatorCount";
import { useNetwork } from "../context/NetworkContext";

vi.mock("../context/NetworkContext", () => ({ useNetwork: vi.fn() }));

const mockedUseNetwork = vi.mocked(useNetwork);

function mockNetwork(rest = "https://node.example.com") {
    mockedUseNetwork.mockReturnValue({ currentNetwork: { name: "t", rpc: "r", rest } } as never);
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

describe("useValidatorCount", () => {
    it("returns the validator set size", async () => {
        mockNetwork();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ block_height: "100", validators: [{}, {}, {}, {}] })
        }));
        const { result } = renderHook(() => useValidatorCount());
        await waitFor(() => expect(result.current).toBe(4));
    });

    it("returns null when the endpoint errors", async () => {
        mockNetwork();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 501 }));
        const { result } = renderHook(() => useValidatorCount());
        await waitFor(() => expect(result.current).toBeNull());
    });

    it("returns null when the response shape is unexpected", async () => {
        mockNetwork();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
        const { result } = renderHook(() => useValidatorCount());
        await waitFor(() => expect(result.current).toBeNull());
    });

    it("does not fetch without a rest endpoint", () => {
        mockNetwork("");
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        renderHook(() => useValidatorCount());
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
