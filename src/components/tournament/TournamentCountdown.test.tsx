// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import TournamentCountdown from "./TournamentCountdown";

const NOW = new Date("2026-11-25T10:00:00Z").getTime();

function show(secondsAhead: number, entrants = 6, minEntrants = 6, startTime = NOW + secondsAhead * 1000) {
    return render(<TournamentCountdown startTime={startTime} entrants={entrants} minEntrants={minEntrants} />);
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe("TournamentCountdown", () => {
    it("splits a long wait into days, hours, minutes and seconds", () => {
        show(2 * 86_400 + 3 * 3600 + 4 * 60 + 5);
        expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("Starts in 2 days 3 hours");
        for (const label of ["days", "hours", "min", "sec"]) expect(screen.getByText(label)).toBeTruthy();
        expect(screen.getByText("02")).toBeTruthy();
        expect(screen.getByText("05")).toBeTruthy();
    });

    it("drops the units that are zero from the top", () => {
        show(4 * 60 + 5);
        expect(screen.queryByText("days")).toBeNull();
        expect(screen.queryByText("hours")).toBeNull();
        expect(screen.getByText("min")).toBeTruthy();
    });

    it("ticks every second", () => {
        show(65);
        expect(screen.getByText("05")).toBeTruthy();
        act(() => void vi.advanceTimersByTime(2000));
        expect(screen.getByText("03")).toBeTruthy();
    });

    it("turns into one big number for the last ten seconds", () => {
        show(7);
        expect(screen.getByText("Get ready")).toBeTruthy();
        expect(screen.getByText("7")).toBeTruthy();
        expect(screen.queryByText("min")).toBeNull();
    });

    it("says to shuffle up when time is up and the field is big enough", () => {
        show(2);
        act(() => void vi.advanceTimersByTime(3000));
        expect(screen.getByText("Shuffle up and deal!")).toBeTruthy();
    });

    it("says it is waiting for players when time is up and the field is short", () => {
        show(-5, 4, 6);
        expect(screen.getByText("Waiting for players…")).toBeTruthy();
        expect(screen.getByText("2 more players are needed to start")).toBeTruthy();
    });

    it("says how many more players are needed, singular too", () => {
        show(3600, 5, 6);
        expect(screen.getByText("1 more player is needed to start")).toBeTruthy();
    });

    it("has no clock when it starts when the field is full", () => {
        show(0, 3, 6, 0);
        expect(screen.getByText("Starts when the field is full")).toBeTruthy();
        expect(screen.queryByRole("timer")).toBeNull();
    });
});
