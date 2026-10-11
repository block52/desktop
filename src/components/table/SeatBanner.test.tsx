// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import SeatBanner from "./SeatBanner";

afterEach(cleanup);

describe("SeatBanner", () => {
    it("renders nothing when there is nothing to show", () => {
        const { container } = render(<SeatBanner />);
        expect(container.firstChild).toBeNull();
    });

    it("shows the turn countdown while the seat is to act", () => {
        render(<SeatBanner isActive turnTimeoutSec={30} />);
        expect(screen.getByRole("timer")).toBeTruthy();
    });

    it("falls back to the standing status", () => {
        render(<SeatBanner status="FOLD" />);
        expect(screen.getByText("FOLD")).toBeTruthy();
    });

    it("does not announce the action already on the seat at mount", () => {
        render(<SeatBanner lastAction={{ action: "call", amount: "50", index: 7 }} />);
        expect(screen.queryByText("CALL")).toBeNull();
    });

    it("announces a new action, then clears it", async () => {
        const { rerender } = render(<SeatBanner lastAction={{ action: "call", amount: "50", index: 7 }} />);
        rerender(<SeatBanner lastAction={{ action: "raise", amount: "200", index: 8 }} />);
        expect(screen.getByText("RAISE")).toBeTruthy();
        expect(screen.getByText("200")).toBeTruthy();
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 2600));
        });
        expect(screen.queryByText("RAISE")).toBeNull();
    });
});
