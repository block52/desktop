// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@block52/ui-sdk";
import type { TournamentStateDTO } from "@block52/poker-vm-sdk";
import Tournament from "./Tournament";

const ID = `0x${"6c".repeat(32)}`;
const ME = "b521me";

const state: { tournament: TournamentStateDTO | null; isLoading: boolean; error: string; me: string | null } = { tournament: null, isLoading: false, error: "", me: ME };
const refetch = vi.fn(async () => undefined);
const registerTournament = vi.fn(async () => "0xhash");

vi.mock("../../hooks/useTournament", () => ({ useTournament: () => ({ tournament: state.tournament, isLoading: state.isLoading, error: state.error, refetch }) }));
vi.mock("../../utils/cosmos/storage", () => ({ getCosmosAddress: () => state.me }));
vi.mock("../../utils/cosmos/client", () => ({ getSigningClient: async () => ({ signingClient: { registerTournament }, userAddress: ME }) }));
vi.mock("../../context/NetworkContext", () => ({ useNetwork: () => ({ currentNetwork: { rpc: "r", rest: "r" } }) }));

function make(overrides: Partial<TournamentStateDTO> = {}): TournamentStateDTO {
    return {
        tournamentId: ID,
        status: "registering",
        options: {
            buyIn: "2000000",
            entryFee: "200000",
            startingStack: "5000",
            seatsPerTable: 9,
            minEntrants: 6,
            maxEntrants: 27,
            startTime: 1795601100000,
            blindStructure: { preset: "turbo" }
        },
        entrants: [{ address: "b521other", status: "registered", stack: "0" }],
        tables: [],
        level: 0,
        prizePool: "0",
        payouts: [],
        results: [],
        intents: [],
        seq: 0,
        ...overrides
    } as unknown as TournamentStateDTO;
}

function show(path = `/tournament/${ID}`) {
    return render(
        <ToastProvider>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/tournament/:id" element={<Tournament />} />
                    <Route path="/table/:id" element={<p>table page</p>} />
                    <Route path="/players/:address" element={<p>player profile</p>} />
                </Routes>
            </MemoryRouter>
        </ToastProvider>
    );
}

beforeEach(() => {
    state.tournament = make();
    state.isLoading = false;
    state.error = "";
    state.me = ME;
    registerTournament.mockClear();
    refetch.mockClear();
});
afterEach(cleanup);

describe("Tournament page", () => {
    it("shows the terms and who is in", () => {
        show();
        expect(screen.getByText("Registering")).toBeTruthy();
        expect(screen.getByText("1 / 27 (min 6)")).toBeTruthy();
        expect(screen.getByText("$2 + $0.2 fee")).toBeTruthy();
        expect(screen.getByText("turbo")).toBeTruthy();
        expect(screen.getByText("b521other")).toBeTruthy();
    });

    it("tells a seated player where they sit, highlights that table, and goes to it", () => {
        state.tournament = make({
            status: "running",
            entrants: [
                { address: ME, status: "playing", tableId: `${ID}-t2`, seat: 5, stack: "4200" },
                { address: "b521other", status: "playing", tableId: `${ID}-t1`, seat: 2, stack: "6000" }
            ] as TournamentStateDTO["entrants"],
            tables: [
                { tableId: `${ID}-t1`, ordinal: 1, players: ["b521other"], broken: false, handNumber: 3, atBoundary: false },
                { tableId: `${ID}-t2`, ordinal: 2, players: [ME], broken: false, handNumber: 3, atBoundary: false }
            ]
        });
        show();
        expect(screen.getByText("You are seated")).toBeTruthy();
        expect(screen.getByText("Table 2, seat 5 · stack 4200")).toBeTruthy();
        expect(screen.getByText("You are here · seat 5")).toBeTruthy();
        expect(screen.getByText("Table 1, seat 2")).toBeTruthy();
        fireEvent.click(screen.getByText("Go to your table"));
        expect(screen.getByText("table page")).toBeTruthy();
    });

    it("says when you were eliminated, and shows no seat banner when not seated", () => {
        state.tournament = make({ status: "running", entrants: [{ address: ME, status: "busted", stack: "0" }] as TournamentStateDTO["entrants"] });
        show();
        expect(screen.getByText("You were eliminated from this tournament.")).toBeTruthy();
        expect(screen.queryByText("You are seated")).toBeNull();
    });

    it("shows each entrant's whole address and opens their profile", () => {
        const address = `b521${"q".repeat(40)}`;
        state.tournament = make({ entrants: [{ address, status: "registered", stack: "0" }] as TournamentStateDTO["entrants"] });
        show();
        fireEvent.click(screen.getByText(address));
        expect(screen.getByText("player profile")).toBeTruthy();
    });

    it("gives the Register and Go to your table buttons the pill shape", () => {
        show();
        expect(screen.getByText("Register for $2.2").className).toContain("btn-pill");
        cleanup();
        state.tournament = make({ status: "running", entrants: [{ address: ME, status: "playing", tableId: `${ID}-t1`, seat: 1, stack: "1" }] as TournamentStateDTO["entrants"] });
        show();
        expect(screen.getByText("Go to your table").className).toContain("btn-pill");
    });

    it("registers for the full cost and refreshes", async () => {
        show();
        fireEvent.click(screen.getByText("Register for $2.2"));
        await waitFor(() => expect(registerTournament).toHaveBeenCalledWith(ID));
        await waitFor(() => expect(refetch).toHaveBeenCalled());
    });

    it("shows why registration was refused, without Electron's IPC prefix", async () => {
        registerTournament.mockRejectedValueOnce(new Error("Error invoking remote method 'wallet:signing-call': Error: insufficient funds"));
        show();
        fireEvent.click(screen.getByText("Register for $2.2"));
        expect(await screen.findAllByText("insufficient funds")).not.toHaveLength(0);
    });

    it("does not offer registration to someone already in, or once it has started", () => {
        state.tournament = make({ entrants: [{ address: "B521ME", status: "registered", stack: "0" }] as TournamentStateDTO["entrants"] });
        show();
        expect((screen.getByText("You are registered") as HTMLButtonElement).disabled).toBe(true);
        cleanup();
        state.tournament = make({ status: "running" });
        show();
        expect(screen.queryByText(/Register for/)).toBeNull();
    });

    it("asks for a wallet when there is none", () => {
        state.me = null;
        show();
        expect(screen.getByText("Create or import a wallet to register.")).toBeTruthy();
        expect((screen.getByText("Register for $2.2") as HTMLButtonElement).disabled).toBe(true);
    });

    it("links a running tournament's tables and hides broken ones", () => {
        state.tournament = make({
            status: "running",
            tables: [
                { tableId: `${ID}-t1`, ordinal: 1, players: ["a", "b", "c"], broken: false, handNumber: 3, atBoundary: false },
                { tableId: `${ID}-t2`, ordinal: 2, players: [], broken: true, handNumber: 9, atBoundary: false }
            ]
        });
        show();
        fireEvent.click(screen.getByText("Table 1"));
        expect(screen.getByText("table page")).toBeTruthy();
        cleanup();
        show();
        expect(screen.queryByText("Table 2")).toBeNull();
    });

    it("says so when the chain has no such tournament, or the id is not one", () => {
        state.tournament = null;
        show();
        expect(screen.getByText("No tournament with that id on this network.")).toBeTruthy();
        cleanup();
        show("/tournament/nope");
        expect(screen.getByText("That is not a tournament id.")).toBeTruthy();
    });
});
