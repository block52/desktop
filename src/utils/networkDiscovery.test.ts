import { describe, expect, it, vi } from "vitest";
import { COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import {
    candidatesFromValidators,
    discoverNetworks,
    endpointsForHost,
    hostFromWebsite
} from "./networkDiscovery";
import type { NetworkEndpoints } from "../context/NetworkContext";

describe("hostFromWebsite", () => {
    it("extracts the host from an https url", () => {
        expect(hostFromWebsite("https://node.example.com")).toBe("node.example.com");
        expect(hostFromWebsite("https://node.example.com/rpc/")).toBe("node.example.com");
    });
    it("rejects empty, non-string and non-http values", () => {
        expect(hostFromWebsite("")).toBeNull();
        expect(hostFromWebsite(undefined)).toBeNull();
        expect(hostFromWebsite("not a url")).toBeNull();
        expect(hostFromWebsite("ftp://x")).toBeNull();
    });
});

describe("endpointsForHost", () => {
    it("builds the standard endpoint pattern", () => {
        expect(endpointsForHost("Example", "node.example.com")).toEqual({
            name: "Example",
            rest: "https://node.example.com",
            rpc: "https://node.example.com/rpc/",
            grpc: "grpcs://node.example.com:9443",
            ws: "wss://node.example.com/ws"
        });
    });
});

describe("candidatesFromValidators", () => {
    it("takes validators with a website, de-duplicated by host, moniker-named", () => {
        const out = candidatesFromValidators({
            validators: [
                { description: { moniker: "Miller", website: "https://node.miller.com" } },
                { description: { moniker: "NoSite", website: "" } },
                { description: { moniker: "Dup", website: "https://node.miller.com/rpc/" } },
                { description: { website: "https://node.anon.com" } } // no moniker → host as name
            ]
        });
        expect(out).toEqual([
            { name: "Miller", host: "node.miller.com" },
            { name: "node.anon.com", host: "node.anon.com" }
        ]);
    });
    it("handles a malformed response", () => {
        expect(candidatesFromValidators(null)).toEqual([]);
        expect(candidatesFromValidators({})).toEqual([]);
    });
});

describe("discoverNetworks", () => {
    const known: NetworkEndpoints[] = [
        { name: "Block52", rest: "https://node1.block52.xyz", rpc: "", grpc: "", ws: "" }
    ];

    function fetchMock(handlers: Record<string, unknown>) {
        return vi.fn(async (url: string) => {
            for (const [frag, body] of Object.entries(handlers)) {
                if (url.includes(frag)) return { ok: true, json: async () => body } as Response;
            }
            return { ok: false, json: async () => ({}) } as Response;
        }) as unknown as typeof fetch;
    }

    it("returns verified, fresh pokerchain nodes only", async () => {
        const fetchImpl = fetchMock({
            "/cosmos/staking/": {
                validators: [
                    { description: { moniker: "New", website: "https://node.new.com" } },
                    { description: { moniker: "Wrong", website: "https://node.wrong.com" } },
                    { description: { moniker: "Block52", website: "https://node1.block52.xyz" } } // already known
                ]
            },
            "node.new.com/cosmos/base/tendermint/v1beta1/node_info": {
                default_node_info: { network: COSMOS_CONSTANTS.CHAIN_ID }
            },
            "node.wrong.com/cosmos/base/tendermint/v1beta1/node_info": {
                default_node_info: { network: "some-other-chain" }
            }
        });

        const found = await discoverNetworks("https://node1.block52.xyz", known, fetchImpl);
        expect(found).toHaveLength(1);
        expect(found[0].name).toBe("New");
        expect(found[0].rest).toBe("https://node.new.com");
    });

    it("returns nothing when the validators call fails", async () => {
        const fetchImpl = vi.fn(async () => ({ ok: false, json: async () => ({}) }) as Response) as unknown as typeof fetch;
        expect(await discoverNetworks("https://x", known, fetchImpl)).toEqual([]);
    });

    it("excludes a host already in the known list", async () => {
        const fetchImpl = fetchMock({
            "/cosmos/staking/": { validators: [{ description: { moniker: "Block52", website: "https://node1.block52.xyz" } }] }
        });
        expect(await discoverNetworks("https://node1.block52.xyz", known, fetchImpl)).toEqual([]);
    });
});
