// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { normalizeValidatorEarning, useNodeRegistry, useValidatorEarnings } from "./useNodeRegistry";
import { getCosmosClient } from "../utils/cosmos/client";
import { useNetwork } from "../context/NetworkContext";

vi.mock("../utils/cosmos/client", () => ({ getCosmosClient: vi.fn() }));
vi.mock("../context/NetworkContext", () => ({ useNetwork: vi.fn() }));

const mockedGetCosmosClient = vi.mocked(getCosmosClient);
const mockedUseNetwork = vi.mocked(useNetwork);

const NET_A = { name: "Alpha", rpc: "https://a/rpc/", rest: "https://a", ws: "wss://a/ws", grpc: "grpcs://a:9443" };
const NET_B = { name: "Beta", rpc: "https://b/rpc/", rest: "https://b", ws: "wss://b/ws", grpc: "grpcs://b:9443" };

function mockNode(online: boolean, height: string, validators: unknown[]) {
    mockedGetCosmosClient.mockImplementation((n: { rest?: string }) => {
        if (!online) return null;
        if (n.rest === "https://a") return { getLatestBlocks: vi.fn().mockResolvedValue([{ block: { header: { height } } }]) } as never;
        return { getLatestBlocks: vi.fn().mockRejectedValue(new Error("down")) } as never;
    });
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
        if (url.startsWith("https://a/")) {
            return { ok: true, json: async () => ({ validators }) };
        }
        throw new Error("network down");
    }));
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

describe("normalizeValidatorEarning", () => {
    it("maps operator, moniker, and bonded USDC", () => {
        expect(
            normalizeValidatorEarning({
                operator_address: "b52valoper1abc",
                description: { moniker: "node1" },
                tokens: "25000000"
            })
        ).toEqual({ operatorAddress: "b52valoper1abc", moniker: "node1", bondedUsdc: 25 });
    });

    it("returns null without operator or tokens", () => {
        expect(normalizeValidatorEarning({})).toBeNull();
        expect(normalizeValidatorEarning({ operator_address: "x" })).toBeNull();
    });
});

describe("useNodeRegistry", () => {
    it("reports health, height, validator role, and node id per network", async () => {
        mockNode(true, "506717", [{ operator_address: "b52valoper1x" }]);
        vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
            if (url.includes("/cosmos/staking/")) {
                return { ok: true, json: async () => ({ validators: [{}] }) };
            }
            if (url.includes("/node_info")) {
                return { ok: true, json: async () => ({ default_node_info: { default_node_id: "node-id-abc" } }) };
            }
            throw new Error(`unexpected url: ${url}`);
        }));
        const { result } = renderHook(() => useNodeRegistry([NET_A]));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const alpha = result.current.entries.find(e => e.network.name === "Alpha");
        expect(alpha).toEqual({ network: NET_A, online: true, blockHeight: "506717", isValidator: true, nodeId: "node-id-abc" });
    });

    it("falls back to the legacy id field when default_node_id is absent", async () => {
        mockNode(true, "506717", []);
        vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
            if (url.includes("/node_info")) {
                return { ok: true, json: async () => ({ default_node_info: { id: "legacy-id" } }) };
            }
            return { ok: true, json: async () => ({ validators: [] }) };
        }));
        const { result } = renderHook(() => useNodeRegistry([NET_A]));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.entries[0].nodeId).toBe("legacy-id");
    });

    it("marks unreachable nodes offline with no height", async () => {
        mockNode(true, "506717", []);
        const { result } = renderHook(() => useNodeRegistry([NET_B]));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const beta = result.current.entries.find(e => e.network.name === "Beta");
        expect(beta?.online).toBe(false);
        expect(beta?.blockHeight).toBeNull();
    });
});

describe("useValidatorEarnings", () => {
    it("lists validators sorted by bonded amount desc", async () => {
        mockedUseNetwork.mockReturnValue({ currentNetwork: NET_A } as never);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                validators: [
                    { operator_address: "b52valoper1small", description: { moniker: "small" }, tokens: "10000000" },
                    { operator_address: "b52valoper1big", description: { moniker: "big" }, tokens: "99000000" }
                ]
            })
        }));

        const { result } = renderHook(() => useValidatorEarnings());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.error).toBe("");
        expect(result.current.validators.map(v => v.moniker)).toEqual(["big", "small"]);
        expect(result.current.validators[0].bondedUsdc).toBe(99);
    });
});
