import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGame, waitForGameId } from "./createGame";
import * as cosmosClient from "../utils/cosmos/client";
import type { NetworkEndpoints } from "../context/NetworkContext";

const mockNetwork: NetworkEndpoints = {
    name: "Test",
    rpc: "http://localhost:26657",
    rest: "http://localhost:1317",
    grpc: "http://localhost:9090",
    ws: "ws://localhost:26657/ws",
};

describe("createGame", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("calls signingClient.createGame with the given params and returns the game ID from the tx event", async () => {
        const mockCreateGame = vi.fn().mockResolvedValue("TXHASH");
        vi.spyOn(cosmosClient, "getCosmosClient").mockReturnValue({
            getTx: vi.fn().mockResolvedValue({
                tx_response: {
                    code: 0,
                    events: [{ type: "game_created", attributes: [{ key: "game_id", value: "game-abc-123" }] }]
                }
            })
        } as never);
        vi.spyOn(cosmosClient, "withMoneyMoverRetry").mockImplementation(
            async (_network, fn) => fn({ signingClient: { createGame: mockCreateGame } } as never)
        );

        const result = await createGame(
            {
                gameFormat: "cash",
                gameVariant: "texas-holdem",
                minPlayers: 2,
                maxPlayers: 6,
                minBuyIn: 1000000n,
                maxBuyIn: 2000000n,
                smallBlind: 10000n,
                bigBlind: 20000n,
                timeout: 30,
            },
            mockNetwork
        );

        expect(result).toBe("game-abc-123");
        expect(mockCreateGame).toHaveBeenCalledWith(
            "cash", "texas-holdem", 2, 6, 1000000n, 2000000n, 10000n, 20000n, 30,
            undefined, undefined, undefined
        );
    });

    it("passes rakeConfig, sngConfig, and name through when provided", async () => {
        const mockCreateGame = vi.fn().mockResolvedValue("TXHASH");
        vi.spyOn(cosmosClient, "getCosmosClient").mockReturnValue({
            getTx: vi.fn().mockResolvedValue({
                tx_response: { code: 0, events: [{ type: "game_created", attributes: [{ key: "game_id", value: "game-xyz" }] }] }
            })
        } as never);
        vi.spyOn(cosmosClient, "withMoneyMoverRetry").mockImplementation(
            async (_network, fn) => fn({ signingClient: { createGame: mockCreateGame } } as never)
        );

        const rakeConfig = { rakeFreeThreshold: 0n, rakePercentage: 5, rakeCap: 500000n, owner: "b52creator" };
        const sngConfig = { startingStack: 5000000n, blindLevelDuration: 600 };

        await createGame(
            {
                gameFormat: "sit-and-go",
                gameVariant: "texas-holdem",
                minPlayers: 6,
                maxPlayers: 6,
                minBuyIn: 1000000n,
                maxBuyIn: 1000000n,
                smallBlind: 10000n,
                bigBlind: 20000n,
                timeout: 30,
                rakeConfig,
                sngConfig,
                name: "Friday Degens",
            },
            mockNetwork
        );

        expect(mockCreateGame).toHaveBeenCalledWith(
            "sit-and-go", "texas-holdem", 6, 6, 1000000n, 1000000n, 10000n, 20000n, 30,
            rakeConfig, sngConfig, "Friday Degens"
        );
    });
});

describe("waitForGameId", () => {
    const created = (gameId: string) => ({
        tx_response: { code: 0, events: [{ type: "game_created", attributes: [{ key: "game_id", value: gameId }] }] }
    });

    it("retries until the transaction is indexed, then returns the game id", async () => {
        const getTx = vi
            .fn()
            .mockRejectedValueOnce(new Error("not found"))
            .mockResolvedValueOnce(created("0xabc"));
        await expect(waitForGameId({ getTx }, "HASH", { attempts: 5, delayMs: 0 })).resolves.toBe("0xabc");
        expect(getTx).toHaveBeenCalledTimes(2);
    });

    it("throws the raw log when the transaction failed", async () => {
        const getTx = vi.fn().mockResolvedValue({ tx_response: { code: 5, raw_log: "insufficient funds" } });
        await expect(waitForGameId({ getTx }, "HASH", { attempts: 2, delayMs: 0 })).rejects.toThrow("insufficient funds");
    });

    it("throws when the transaction never shows up", async () => {
        const getTx = vi.fn().mockRejectedValue(new Error("not found"));
        await expect(waitForGameId({ getTx }, "HASH", { attempts: 3, delayMs: 0 })).rejects.toThrow(/not confirmed/);
    });

    it("throws when no game_created event is present", async () => {
        const getTx = vi.fn().mockResolvedValue({ tx_response: { code: 0, events: [] } });
        await expect(waitForGameId({ getTx }, "HASH", { attempts: 1, delayMs: 0 })).rejects.toThrow(/game_created/);
    });
});
