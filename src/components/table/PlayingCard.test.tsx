// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import PlayingCard, { parseCard, SUIT_SYMBOLS } from "./PlayingCard";

afterEach(cleanup);

describe("parseCard", () => {
    it("parses SDK rank+suit codes", () => {
        expect(parseCard("AS")).toEqual({ rank: "A", suit: "S" });
        expect(parseCard("KD")).toEqual({ rank: "K", suit: "D" });
        expect(parseCard("TH")).toEqual({ rank: "10", suit: "H" });
        expect(parseCard("6C")).toEqual({ rank: "6", suit: "C" });
    });

    it("parses symbol and lowercase forms", () => {
        expect(parseCard("A♠")).toEqual({ rank: "A", suit: "S" });
        expect(parseCard("qh")).toEqual({ rank: "Q", suit: "H" });
        expect(parseCard("10d")).toEqual({ rank: "10", suit: "D" });
    });

    it("returns null for invalid codes", () => {
        expect(parseCard("")).toBeNull();
        expect(parseCard("1S")).toBeNull();
        expect(parseCard("AX")).toBeNull();
        expect(parseCard("XX")).toBeNull();
    });
});

describe("SUIT_SYMBOLS", () => {
    it("covers all four suits", () => {
        expect(SUIT_SYMBOLS).toEqual({ S: "♠", H: "♥", D: "♦", C: "♣" });
    });
});

describe("PlayingCard", () => {
    it("renders the rank and suit", () => {
        render(<PlayingCard code="AS" />);
        expect(screen.getByText("A")).toBeTruthy();
        expect(screen.getAllByText("♠").length).toBeGreaterThanOrEqual(2);
    });

    it("renders ten as 10", () => {
        render(<PlayingCard code="TH" />);
        expect(screen.getByText("10")).toBeTruthy();
        expect(screen.getAllByText("♥").length).toBeGreaterThanOrEqual(2);
    });

    it("renders face-down without rank text", () => {
        render(<PlayingCard code="AS" faceDown />);
        expect(screen.queryByText("A")).toBeNull();
        expect(screen.getByTestId("card-back")).toBeTruthy();
    });

    it("renders nothing for an invalid code", () => {
        const { container } = render(<PlayingCard code="bogus" />);
        expect(container.firstChild).toBeNull();
    });
});
