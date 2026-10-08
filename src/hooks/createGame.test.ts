import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGame } from "./createGame";
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

    it("calls signingClient.createGame with the given params and returns the game ID", async () => {
        const mockCreateGame = vi.fn().mockResolvedValue("game-abc-123");
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
        const mockCreateGame = vi.fn().mockResolvedValue("game-xyz");
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
