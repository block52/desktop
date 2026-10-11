// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import NotesGrid from "./NotesGrid";

const NOTES = [
    {
        tag: "SHUFFLING",
        title: "Provably fair shuffling",
        body: "Every deck is committed on-chain before cards are dealt."
    },
    {
        tag: "PVM",
        title: "Poker Virtual Machine",
        body: "Game logic runs in the PVM, a deterministic poker state machine."
    }
];

afterEach(cleanup);

describe("NotesGrid", () => {
    it("renders note cards with tag, title, and body", () => {
        render(<NotesGrid notes={NOTES} />);

        expect(screen.getByText("SHUFFLING")).toBeTruthy();
        expect(screen.getByText("Provably fair shuffling")).toBeTruthy();
        expect(screen.getByText("Every deck is committed on-chain before cards are dealt.")).toBeTruthy();

        expect(screen.getByText("PVM")).toBeTruthy();
        expect(screen.getByText("Poker Virtual Machine")).toBeTruthy();
        expect(screen.getByText(/deterministic poker state machine/)).toBeTruthy();
    });
});
