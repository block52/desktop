// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";

const simulateContract = vi.fn();

vi.mock("wagmi", () => ({ usePublicClient: () => ({ simulateContract }) }));
vi.mock("../context/NetworkContext", () => ({ useNetwork: () => ({ currentNetwork: { rest: "https://node" } }) }));

import { usePaidOutWithdrawals } from "./usePaidOutWithdrawals";

const SIGNATURE = `0x${"ab".repeat(65)}`;
const item = (nonce: string) => ({
    nonce,
    toAddress: "0x439cc0da0773bf078160f36afe816f5079a599f3",
    amountMicro: "1000000",
    status: "pending" as const,
    createdAt: 1700000000,
    signature: null
});

function stubSignatureEndpoint() {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
            const nonce = decodeURIComponent(url.split("/").pop() as string);
            return {
                ok: true,
                status: 200,
                json: async () => ({ receiver: "0x439cc0da0773bf078160f36afe816f5079a599f3", amount: "1000000", nonce, signature: SIGNATURE })
            };
        })
    );
}

describe("usePaidOutWithdrawals", () => {
    afterEach(() => {
        // unmount first, so a check still running when the test ends cannot update state after the DOM is gone
        cleanup();
        vi.unstubAllGlobals();
        simulateContract.mockReset();
    });

    it("reports the withdrawals the bridge says were already paid out", async () => {
        stubSignatureEndpoint();
        const used = `0x${"0".repeat(63)}7`;
        const open = `0x${"0".repeat(63)}8`;
        simulateContract.mockImplementation(async (call: { args: unknown[] }) => {
            if (call.args[2] === used) throw new Error("execution reverted: withdraw: nonce already used");
            return {};
        });

        const { result } = renderHook(() => usePaidOutWithdrawals([item(used), item(open)], 0));

        await waitFor(() => expect(result.current.has(used)).toBe(true));
        expect(result.current.has(open)).toBe(false);
    });

    it("does not treat another failure as paid out", async () => {
        stubSignatureEndpoint();
        const nonce = `0x${"0".repeat(63)}9`;
        simulateContract.mockRejectedValue(new Error("network down"));

        const { result } = renderHook(() => usePaidOutWithdrawals([item(nonce)], 0));

        await waitFor(() => expect(simulateContract).toHaveBeenCalled());
        expect(result.current.has(nonce)).toBe(false);
    });
});
