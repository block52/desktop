// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Seat from "./Seat";

beforeAll(() => {
    globalThis.ResizeObserver = class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    };
});

afterEach(cleanup);

const base = { left: 30, top: 40, occupied: true, name: "Seat 3", seatNumber: 3, stack: "$10.00" };

describe("Seat", () => {
    it("shows the turn countdown around the avatar while the seat is to act", () => {
        render(<Seat {...base} isActive turnTimeoutSec={30} turnRemainingSec={12} turnKey="t1" />);
        const timer = screen.getByRole("timer", { name: "Time to act" });
        expect(timer.textContent).toBe("12");
    });

    it("has no countdown when the seat is not to act", () => {
        render(<Seat {...base} turnTimeoutSec={30} turnRemainingSec={12} />);
        expect(screen.queryByRole("timer")).toBeNull();
    });

    it("keeps the seat's last action on the avatar", () => {
        render(<Seat {...base} lastAction={{ action: "all-in", index: 4 }} />);
        expect(screen.getByText("All-in")).toBeTruthy();
    });

    it("marks a folded seat with a Fold chip, and shows nothing for blind posts", () => {
        const { container, rerender } = render(<Seat {...base} isFolded />);
        expect(screen.getByText("Fold")).toBeTruthy();
        rerender(<Seat {...base} lastAction={{ action: "post-big-blind", index: 1 }} />);
        expect(screen.queryByText("Fold")).toBeNull();
        expect(container.querySelector("[class*='actionChip']")).toBeNull();
    });
});
