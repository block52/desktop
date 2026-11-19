import { beforeEach, describe, expect, it, vi } from "vitest";

const { broadcastAction } = vi.hoisted(() => ({ broadcastAction: vi.fn(async () => ({ txHash: "0xhash", gameId: "table" })) }));

vi.mock("../../utils/cosmos/walletBridge", () => ({ requireWalletBridge: () => ({ broadcastAction }) }));

import { goBroadcast } from "./goSigner";

const NETWORK = { name: "Test", rpc: "http://rpc", rest: "http://rest", grpc: "grpcs://node:9443", ws: "wss://node/ws" };

beforeEach(() => broadcastAction.mockClear());

describe("goBroadcast", () => {
    it("sends a Sit & Go claim's finishing order with the leave", async () => {
        const hash = await goBroadcast(NETWORK, { kind: "leave", gameId: "table", finishingOrder: ["b52first", "b52second"] });
        expect(hash).toBe("0xhash");
        expect(broadcastAction).toHaveBeenCalledWith("grpcs://node:9443", "pokerchain", { kind: "leave", gameId: "table", finishingOrder: ["b52first", "b52second"] });
    });

    it("leaves a cash-game leave without an order", async () => {
        await goBroadcast(NETWORK, { kind: "leave", gameId: "table" });
        expect(broadcastAction).toHaveBeenCalledWith("grpcs://node:9443", "pokerchain", { kind: "leave", gameId: "table", finishingOrder: undefined });
    });

    it("narrows micro amounts to numbers and refuses ones past the safe range", async () => {
        await goBroadcast(NETWORK, { kind: "topUp", gameId: "table", amount: 2_500_000n });
        expect(broadcastAction).toHaveBeenCalledWith("grpcs://node:9443", "pokerchain", { kind: "topUp", gameId: "table", amount: 2_500_000 });
        await expect(goBroadcast(NETWORK, { kind: "topUp", gameId: "table", amount: BigInt(Number.MAX_SAFE_INTEGER) + 1n })).rejects.toThrow(/safe range/);
    });
});
