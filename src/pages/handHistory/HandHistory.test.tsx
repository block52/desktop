// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const idle = { hands: [], total: 0, isLoading: false, error: "", hasMore: false, loadMore: () => undefined };
const recentHand = { game_id: "0xrecent", hand_number: 7, block_height: 500, deck_seed: "s", created_at: "2026-11-18T10:00:00Z" };

vi.mock("../../hooks/useRecentHands", () => ({ useRecentHands: () => ({ ...idle, hands: [recentHand], total: 1 }) }));
vi.mock("../../hooks/useMyHands", () => ({ useMyHands: () => ({ ...idle, estimated: false, chipTables: new Map() }) }));
vi.mock("../../hooks/useGameHands", () => ({ useGameHands: () => idle }));
vi.mock("../../utils/cosmos/storage", () => ({ getCosmosAddress: () => null }));
vi.mock("./HandReplay", () => ({ default: ({ gameId, handNumber }: { gameId: string; handNumber: number }) => <p>replay {gameId} #{handNumber}</p> }));

import HandHistory from "./HandHistory";

function install(available: boolean) {
    const searchHands = vi.fn(async () => ({
        available: true as const,
        hands: [{ game_id: "0x522af6-t1", hand_number: 29, block_height: 900, deck_seed: "s", created_at: "2026-11-18T10:45:05Z" }],
        total: 108,
    }));
    window.electronAPI = { openExternal: vi.fn(), wallet: {} as never, indexer: { isSearchAvailable: async () => available, searchHands } };
    return searchHands;
}

function renderPage() {
    render(
        <MemoryRouter>
            <HandHistory />
        </MemoryRouter>
    );
}

afterEach(() => {
    cleanup();
    window.electronAPI = undefined;
});

describe("HandHistory search", () => {
    it("searches all tables through the indexer and lists the matches", async () => {
        const searchHands = install(true);
        renderPage();
        const box = await screen.findByLabelText("Search hands");
        fireEvent.change(box, { target: { value: "0x522af6" } });
        fireEvent.click(screen.getByText("Search"));
        await waitFor(() => expect(searchHands).toHaveBeenCalledWith("0x522af6", 25, 0));
        expect(await screen.findByText(/108 hands match/)).toBeTruthy();
        expect(screen.getByText(/Hand #29/)).toBeTruthy();
        expect(screen.queryByText(/Hand #7/)).toBeNull();
    });

    it("goes back to the newest hands when the box is cleared", async () => {
        install(true);
        renderPage();
        const box = await screen.findByLabelText("Search hands");
        fireEvent.change(box, { target: { value: "0x522af6" } });
        fireEvent.click(screen.getByText("Search"));
        await screen.findByText(/Hand #29/);
        fireEvent.change(box, { target: { value: "" } });
        expect(await screen.findByText(/Hand #7/)).toBeTruthy();
    });

    it("does not offer search when the build has no indexer API key", async () => {
        install(false);
        renderPage();
        expect(await screen.findByText(/Hand #7/)).toBeTruthy();
        expect(screen.queryByLabelText("Search hands")).toBeNull();
    });
});
