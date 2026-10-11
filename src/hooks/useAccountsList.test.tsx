// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { fromBech32 } from "@cosmjs/encoding";
import { computeUsdcValue, extractAccountAddress, useAccountsList, valoperToAccount } from "./useAccountsList";
import { useNetwork } from "../context/NetworkContext";

vi.mock("../context/NetworkContext", () => ({ useNetwork: vi.fn() }));

const mockedUseNetwork = vi.mocked(useNetwork);

const VALOPER = "b52valoper1z8mqzmtsm37rg9zscmvtrf6c3j0ufjcgglkp29";
const ADDR_A = "b521qqvt4ygyjxnac9xupscgng99k3aqv9u8lqxjjy";
// Account address derived from VALOPER (valoperToAccount is independently verified by its roundtrip test)
const ADDR_B = valoperToAccount(VALOPER);

function mockFetch(balancesByAddress: Record<string, unknown[]>) {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/cosmos/staking/v1beta1/validators")) {
            return {
                ok: true,
                json: async () => ({ validators: [{ operator_address: VALOPER, description: { moniker: "node1" }, status: "BOND_STATUS_BONDED" }] })
            };
        }
        if (url.includes("/cosmos/auth/v1beta1/accounts")) {
            return {
                ok: true,
                json: async () => ({
                    accounts: [
                        { "@type": "/cosmos.auth.v1beta1.BaseAccount", address: ADDR_A },
                        { "@type": "/cosmos.auth.v1beta1.BaseAccount", address: ADDR_B }
                    ]
                })
            };
        }
        const balanceMatch = url.match(/\/cosmos\/bank\/v1beta1\/balances\/(\w+)/);
        if (balanceMatch) {
            const address = balanceMatch[1];
            return { ok: true, json: async () => ({ balances: balancesByAddress[address] ?? [] }) };
        }
        throw new Error(`unexpected url: ${url}`);
    }));
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

describe("extractAccountAddress", () => {
    it("reads flat and nested account addresses", () => {
        expect(extractAccountAddress({ address: ADDR_A })).toBe(ADDR_A);
        expect(extractAccountAddress({ base_account: { address: ADDR_B } })).toBe(ADDR_B);
        expect(extractAccountAddress({})).toBe("");
        expect(extractAccountAddress(null)).toBe("");
    });
});

describe("computeUsdcValue", () => {
    it("sums usdc and uusdc denoms into dollars", () => {
        expect(computeUsdcValue([{ denom: "usdc", amount: "5000000" }, { denom: "uusdc", amount: "2500000" }])).toBe(7.5);
    });

    it("ignores other denoms and malformed amounts", () => {
        expect(computeUsdcValue([{ denom: "stake", amount: "100" }, { denom: "usdc", amount: "abc" }])).toBe(0);
        expect(computeUsdcValue([])).toBe(0);
    });
});

describe("valoperToAccount", () => {
    it("preserves the pubkey data across the prefix conversion", () => {
        const account = valoperToAccount(VALOPER);
        expect(account.startsWith("b521")).toBe(true);
        expect(fromBech32(account).data).toEqual(fromBech32(VALOPER).data);
    });

    it("returns an empty string for invalid input", () => {
        expect(valoperToAccount("not-bech32")).toBe("");
    });
});

describe("useAccountsList", () => {
    it("returns accounts sorted by USDC value desc with validator info", async () => {
        mockedUseNetwork.mockReturnValue({ currentNetwork: { name: "t", rpc: "r", rest: "https://node.example.com" } } as never);
        // ADDR_B is the validator account; give A more USDC so sorting is meaningful
        mockFetch({
            [ADDR_A]: [{ denom: "usdc", amount: "9000000" }],
            [ADDR_B]: [{ denom: "usdc", amount: "5000000" }]
        });

        const { result } = renderHook(() => useAccountsList());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.error).toBe("");
        expect(result.current.total).toBe(2);
        expect(result.current.accounts.map(a => a.address)).toEqual([ADDR_A, ADDR_B]);
        expect(result.current.accounts[0].usdcValue).toBe(9);
        expect(result.current.accounts[0].balances).toEqual([{ denom: "usdc", amount: "9000000" }]);
        const validatorAccount = result.current.accounts[1];
        expect(validatorAccount.validatorMoniker).toBe("node1");
        expect(validatorAccount.validatorStatus).toBe("BONDED");
    });

    it("sets an error when the accounts fetch fails", async () => {
        mockedUseNetwork.mockReturnValue({ currentNetwork: { name: "t", rpc: "r", rest: "https://node.example.com" } } as never);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 501 }));
        const { result } = renderHook(() => useAccountsList());
        await waitFor(() => expect(result.current.error).not.toBe(""));
        expect(result.current.accounts).toEqual([]);
    });
});
