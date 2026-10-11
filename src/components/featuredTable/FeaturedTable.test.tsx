// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FeaturedTable from "./FeaturedTable";
import type { GameWithFormat } from "../../hooks/useFindGames";

afterEach(cleanup);

const game = (currentPlayers: number): GameWithFormat =>
    ({
        gameId: "0x2a66f0b6e3fb9b2e3fd0a4f1f7d9c9a5e4b7c2d1a0f9e8d7c6b5a49382716cb41",
        name: undefined,
        currentPlayers,
        maxPlayers: 4,
        minBuyIn: "100000",
        gameFormat: "sit-and-go"
    }) as unknown as GameWithFormat;

const renderCard = (g: GameWithFormat) =>
    render(
        <MemoryRouter>
            <FeaturedTable game={g} />
        </MemoryRouter>
    );

describe("FeaturedTable", () => {
    it("offers registration while seats are open", () => {
        renderCard(game(2));
        expect(screen.getByRole("button", { name: "Register · $0.10" })).toBeTruthy();
        expect(screen.getByText("Starts when full")).toBeTruthy();
    });

    it("switches to Watch once the table is full", () => {
        renderCard(game(4));
        expect(screen.getByRole("button", { name: "Watch" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: /Register/ })).toBeNull();
        expect(screen.getByText("In progress")).toBeTruthy();
    });
});
