import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { leaveGame, goBroadcast } = vi.hoisted(() => ({ leaveGame: vi.fn(async () => "0xsdk"), goBroadcast: vi.fn(async () => "0xgo") }));

vi.mock("../../utils/cosmos/client", () => ({
    getSigningClient: async () => ({ signingClient: { leaveGame, recordHandEnd: vi.fn() } }),
    withMoneyMoverRetry: async (_network: unknown, run: (client: { signingClient: { leaveGame: typeof leaveGame } }) => Promise<string>) =>
        run({ signingClient: { leaveGame } }),
}));
vi.mock("./goSigner", () => ({ goSignerEnabled: () => import.meta.env.VITE_GO_SIGNER === "true", goBroadcast }));

import { claimWinnings, resultsAlreadyOnChain } from "./claimWinnings";

const NETWORK = { name: "Test", rpc: "http://rpc", rest: "http://rest", grpc: "grpcs://node:9443", ws: "wss://node/ws" };

beforeEach(() => {
    leaveGame.mockClear();
    goBroadcast.mockClear();
});

afterEach(() => vi.unstubAllEnvs());

describe("claimWinnings", () => {
    it("settles through the SDK by default", async () => {
        expect(await claimWinnings("table", NETWORK, undefined)).toEqual({ hash: "0xsdk", gameId: "table" });
        expect(leaveGame).toHaveBeenCalledOnce();
        expect(goBroadcast).not.toHaveBeenCalled();
    });

    it("settles through the Go sidecar, with the finishing order, when VITE_GO_SIGNER is on", async () => {
        vi.stubEnv("VITE_GO_SIGNER", "true");
        expect(await claimWinnings("table", NETWORK, undefined)).toEqual({ hash: "0xgo", gameId: "table" });
        expect(goBroadcast).toHaveBeenCalledWith(NETWORK, { kind: "leave", gameId: "table", finishingOrder: expect.any(Array) });
        expect(leaveGame).not.toHaveBeenCalled();
    });
});

describe("resultsAlreadyOnChain", () => {
    it("treats stale / already-finalized rejections as benign", () => {
        expect(resultsAlreadyOnChain(new Error("hand-end push is stale or the game is already finalized"))).toBe(true);
        expect(resultsAlreadyOnChain(new Error("Stale hand end"))).toBe(true);
    });

    it("treats every other failure as fatal", () => {
        expect(resultsAlreadyOnChain(new Error("insufficient funds"))).toBe(false);
        expect(resultsAlreadyOnChain("network down")).toBe(false);
    });
});
