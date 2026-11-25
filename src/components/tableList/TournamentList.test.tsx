// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { TournamentStateDTO } from "@block52/poker-vm-sdk";
import TournamentList, { TournamentLookupHint } from "./TournamentList";

const A = `0x${"aa".repeat(32)}`;
const B = `0x${"bb".repeat(32)}`;

const list: { tournaments: TournamentStateDTO[]; isLoading: boolean; error: string } = { tournaments: [], isLoading: false, error: "" };
const single: { tournament: TournamentStateDTO | null; isLoading: boolean } = { tournament: null, isLoading: false };

vi.mock("../../hooks/useTournaments", () => ({ useTournaments: () => ({ ...list, refetch: vi.fn() }) }));
vi.mock("../../hooks/useTournament", () => ({ useTournament: () => ({ ...single, error: "", refetch: vi.fn() }) }));

function make(id: string, status: TournamentStateDTO["status"]): TournamentStateDTO {
    return {
        tournamentId: id,
        status,
        options: { buyIn: "2000000", entryFee: "200000", seatsPerTable: 9, minEntrants: 6, maxEntrants: 27, startTime: 1795601100000 },
        entrants: [{ address: "x", status: "registered", stack: "0" }]
    } as unknown as TournamentStateDTO;
}

function show(ui: React.ReactElement) {
    return render(
        <MemoryRouter>
            <Routes>
                <Route path="/" element={ui} />
                <Route path="/tournament/:id" element={<p>tournament page</p>} />
            </Routes>
        </MemoryRouter>
    );
}

beforeEach(() => {
    list.tournaments = [make(A, "registering"), make(B, "finished")];
    list.isLoading = false;
    list.error = "";
    single.tournament = null;
    single.isLoading = false;
});
afterEach(cleanup);

describe("TournamentList", () => {
    it("lists tournaments with status, entrants and total cost, and opens one", () => {
        show(<TournamentList search="" />);
        expect(screen.getByText("Registering")).toBeTruthy();
        expect(screen.getByText("Finished")).toBeTruthy();
        expect(screen.getAllByText(/1 \/ 27 entrants/)).toHaveLength(2);
        expect(screen.getAllByText("$2.2")).toHaveLength(2);
        fireEvent.click(screen.getByText("Register"));
        expect(screen.getByText("tournament page")).toBeTruthy();
    });

    it("filters by id or status word", () => {
        show(<TournamentList search="finished" />);
        expect(screen.queryByText("Registering")).toBeNull();
        expect(screen.getByText("Finished")).toBeTruthy();
    });

    it("looks up a pasted id that is not in the list", () => {
        list.tournaments = [];
        single.tournament = make(B, "registering");
        show(<TournamentList search={`${B}-t2`} />);
        expect(screen.getByText("Registering")).toBeTruthy();
    });

    it("says so when nothing matches, and when the lookup finds nothing", () => {
        show(<TournamentList search="zzz" />);
        expect(screen.getByText("None match your search.")).toBeTruthy();
        cleanup();
        list.tournaments = [];
        show(<TournamentLookupHint id={A} />);
        expect(screen.getByText("No tournament with that id")).toBeTruthy();
    });

    it("shows a load error with a retry when there is nothing to show", () => {
        list.tournaments = [];
        list.error = "HTTP 502";
        show(<TournamentList search="" />);
        expect(screen.getByText("HTTP 502")).toBeTruthy();
        expect(screen.getByText("Retry")).toBeTruthy();
    });
});
