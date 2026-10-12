// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { GameFormat, GameVariant, PlayerStatus, TexasHoldemRound, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import type { GameStateValue } from "../../context/GameStateContext";

// The page is mounted for real; only its data sources and chain calls are replaced.
const hoisted = vi.hoisted(() => ({
    gameStateValue: undefined as unknown,
    address: "b52me" as string | null
}));

vi.mock("../../context/GameStateContext", () => ({ useGameState: () => hoisted.gameStateValue }));
vi.mock("../../context/NetworkContext", () => ({
    useNetwork: () => ({
        currentNetwork: { name: "Test", rpc: "http://rpc", rest: "http://rest", grpc: "http://grpc", ws: "ws://ws" }
    })
}));
vi.mock("../../context/ToastContext", () => ({
    useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() })
}));
vi.mock("../../hooks/useCosmosWallet", () => ({
    useCosmosWallet: () => ({ balance: [], address: hoisted.address, refreshBalance: vi.fn() })
}));
vi.mock("../../utils/cosmos/storage", () => ({
    getCosmosAddress: () => hoisted.address,
    getCosmosMnemonic: () => null
}));
vi.mock("../../hooks/useHandSeed", () => ({ useHandSeed: () => null }));
vi.mock("../../components/table/TableHeader", () => ({ TableHeader: () => null }));

import Table from "./Table";

function stateValue(overrides: Partial<GameStateValue>): GameStateValue {
    return {
        gameState: undefined,
        gameFormat: undefined,
        gameVariant: undefined,
        gameName: undefined,
        gameCreator: undefined,
        isLoading: false,
        error: null,
        validationError: null,
        pendingAction: null,
        latestEvents: [],
        subscribeToTable: vi.fn(),
        unsubscribeFromTable: vi.fn(),
        getLatestSnapshot: () => undefined,
        connection: { status: "live", attempt: 0 },
        retryConnection: vi.fn(),
        ...overrides
    };
}

const cashTable = {
    gameOptions: {
        minBuyIn: "400000",
        maxBuyIn: "2000000",
        minPlayers: 2,
        maxPlayers: 9,
        smallBlind: "10000",
        bigBlind: "20000",
        timeout: 30000
    },
    players: [
        {
            address: "b52me",
            seat: 1,
            stack: "1000000",
            status: PlayerStatus.ACTIVE,
            holeCards: ["AS", "KD"],
            sumOfBets: "0",
            legalActions: [],
            isSmallBlind: false,
            isBigBlind: false,
            isDealer: true
        }
    ],
    communityCards: [],
    deck: "",
    pots: ["0"],
    totalPot: "0",
    nextToAct: -1,
    previousActions: [],
    actionCount: 0,
    handNumber: 3,
    round: TexasHoldemRound.PREFLOP,
    winners: [],
    results: [],
    payouts: [],
    signature: ""
} as unknown as TexasHoldemStateDTO;

function renderTable(): ReturnType<typeof render> {
    return render(
        <MemoryRouter initialEntries={["/table/0xtable"]}>
            <Routes>
                <Route path="/table/:id" element={<Table onOpenNav={() => undefined} />} />
            </Routes>
        </MemoryRouter>
    );
}

class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}

beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    hoisted.address = "b52me";
    hoisted.gameStateValue = stateValue({ isLoading: true });
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("Table page", () => {
    it("renders while loading, then with the table loaded, without changing its hook order", () => {
        const view = renderTable();

        hoisted.gameStateValue = stateValue({
            gameState: cashTable,
            gameFormat: GameFormat.CASH,
            gameVariant: GameVariant.TEXAS_HOLDEM,
            gameCreator: "b52other"
        });
        // A hook-order change throws "Rendered more hooks than during the previous render".
        view.rerender(
            <MemoryRouter initialEntries={["/table/0xtable"]}>
                <Routes>
                    <Route path="/table/:id" element={<Table onOpenNav={() => undefined} />} />
                </Routes>
            </MemoryRouter>
        );
        expect(view.container.textContent).toContain("Waiting for players");
    });

    it("shows the error page, then recovers when the table arrives", () => {
        hoisted.gameStateValue = stateValue({ error: new Error("Table not found") });
        const view = renderTable();
        expect(view.container.textContent).toContain("Table not found");

        hoisted.gameStateValue = stateValue({ gameState: cashTable, gameFormat: GameFormat.CASH, gameVariant: GameVariant.TEXAS_HOLDEM });
        expect(() => view.rerender(
            <MemoryRouter initialEntries={["/table/0xtable"]}>
                <Routes>
                    <Route path="/table/:id" element={<Table onOpenNav={() => undefined} />} />
                </Routes>
            </MemoryRouter>
        )).not.toThrow();
    });

    it("asks for a wallet when there is none", () => {
        hoisted.address = null;
        const view = renderTable();
        expect(view.container.textContent?.toLowerCase()).toContain("wallet");
    });
});
