// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ReleaseNotesList from "./ReleaseNotesList";
import type { ReleaseNote } from "../../hooks/useReleaseNotes";

const NOTE: ReleaseNote = {
    id: "weekly-2026-W41",
    date: "2026-10-07",
    title: "Self-service node & validator onboarding",
    version: null,
    tags: ["poker-vm@sdk-v1.5.1", "weekly"],
    highlights: ["Shipped self-service onboarding"],
    features: ["Add-node flow in the desktop app"],
    bugFixes: ["Blind posting no longer double-posts"],
    improvements: ["Faster lobby refresh"],
    tests: ["Coverage for onboarding"],
    body: ""
};

afterEach(cleanup);

describe("ReleaseNotesList", () => {
    it("renders tags, title, formatted date, and highlights", () => {
        render(<ReleaseNotesList notes={[NOTE]} />);

        expect(screen.getByText("poker-vm@sdk-v1.5.1")).toBeTruthy();
        expect(screen.getByText("weekly")).toBeTruthy();
        expect(screen.getByText("Self-service node & validator onboarding")).toBeTruthy();
        expect(screen.getByText("October 7, 2026")).toBeTruthy();
        expect(screen.getByText("Highlights")).toBeTruthy();
        expect(screen.getByText("Shipped self-service onboarding")).toBeTruthy();
    });

    it("hides detail sections until the toggle is clicked", () => {
        render(<ReleaseNotesList notes={[NOTE]} />);

        expect(screen.queryByText("Features")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: /Show features, fixes & improvements/ }));
        expect(screen.getByText("Features")).toBeTruthy();
        expect(screen.getByText("Add-node flow in the desktop app")).toBeTruthy();
        expect(screen.getByText("Bug Fixes")).toBeTruthy();
        expect(screen.getByText("Blind posting no longer double-posts")).toBeTruthy();
        expect(screen.getByText("Improvements")).toBeTruthy();
        expect(screen.getByText("Tests")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: /Show less/ }));
        expect(screen.queryByText("Features")).toBeNull();
    });

    it("renders the version pill when present", () => {
        render(<ReleaseNotesList notes={[{ ...NOTE, version: "v1.5.1" }]} />);
        expect(screen.getByText("v1.5.1")).toBeTruthy();
    });

    it("renders a plain body note without sections", () => {
        render(
            <ReleaseNotesList
                notes={[{ ...NOTE, highlights: [], features: [], bugFixes: [], improvements: [], tests: [], body: "Just a plain note body." }]}
            />
        );
        expect(screen.queryByText("Highlights")).toBeNull();
        expect(screen.getByText("Just a plain note body.")).toBeTruthy();
    });
});
