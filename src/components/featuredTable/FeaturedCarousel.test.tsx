// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FeaturedCarousel from "./FeaturedCarousel";
import type { GameWithFormat } from "../../hooks/useFindGames";

const SCHEDULE = {
    tournaments: [
        { id: "tue", name: "Ten Dollar Tuesdays", buyIn: "$10", dayOfWeek: 2, hour: 18, minute: 0, timeZone: "Australia/Sydney", link: "https://example.com/tue" },
        { id: "thu", name: "$50 Thursday", buyIn: "$50", dayOfWeek: 4, hour: 18, minute: 0, timeZone: "Australia/Sydney", link: "https://example.com/thu" }
    ]
};

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

const live = {
    gameId: "0x2a66f0b6e3fb9b2e3fd0a4f1f7d9c9a5e4b7c2d1a0f9e8d7c6b5a49382716cb41",
    currentPlayers: 2,
    maxPlayers: 4,
    minBuyIn: "100000"
} as unknown as GameWithFormat;

function stubSchedule(body: unknown) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }));
}

const renderCarousel = (game: GameWithFormat | null) =>
    render(
        <MemoryRouter>
            <FeaturedCarousel game={game} />
        </MemoryRouter>
    );

describe("FeaturedCarousel", () => {
    it("slides from the live table to the scheduled tournaments", async () => {
        stubSchedule(SCHEDULE);
        renderCarousel(live);
        expect(screen.getByRole("button", { name: "Register · $0.10" })).toBeTruthy();

        await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(3));
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        expect(screen.getByText("Scheduled")).toBeTruthy();
        expect(screen.getByRole("button", { name: /Register · \$(10|50)/ })).toBeTruthy();
    });

    it("shows the scheduled tournaments alone when no table is live", async () => {
        stubSchedule(SCHEDULE);
        renderCarousel(null);
        await waitFor(() => expect(screen.getByText("Scheduled")).toBeTruthy());
        expect(screen.getAllByRole("tab")).toHaveLength(2);
    });

    it("renders nothing when there is no live table and no schedule", async () => {
        stubSchedule({ tournaments: [] });
        const { container } = renderCarousel(null);
        await waitFor(() => expect(container.firstChild).toBeNull());
    });
});
