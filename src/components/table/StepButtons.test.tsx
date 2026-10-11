// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import StepButtons, { type StepButtonsProps } from "./StepButtons";

afterEach(cleanup);

const BASE: StepButtonsProps = {
    showSmallBlind: false,
    showBigBlind: false,
    smallAmount: "0.010",
    bigAmount: "0.020",
    currencySymbol: "$",
    canDeal: false,
    handNumber: 7,
    blockingStep: null,
    disabled: false,
    onPostSmall: () => undefined,
    onPostBig: () => undefined,
    onDeal: () => undefined
};

describe("StepButtons", () => {
    it("offers the small blind with its amount and posts it", () => {
        const onPostSmall = vi.fn();
        render(<StepButtons {...BASE} showSmallBlind onPostSmall={onPostSmall} />);
        fireEvent.click(screen.getByRole("button", { name: "Post small blind $0.010" }));
        expect(onPostSmall).toHaveBeenCalledTimes(1);
    });

    it("shows POSTING… and locks the button while a blind is in flight", () => {
        render(<StepButtons {...BASE} showBigBlind blockingStep="big-blind" />);
        expect(screen.getByRole("button", { name: "POSTING…" })).toHaveProperty("disabled", true);
    });

    it("deals, and names the hand while dealing", () => {
        const onDeal = vi.fn();
        const { rerender } = render(<StepButtons {...BASE} canDeal onDeal={onDeal} />);
        fireEvent.click(screen.getByRole("button", { name: "DEAL" }));
        expect(onDeal).toHaveBeenCalledTimes(1);

        rerender(<StepButtons {...BASE} canDeal blockingStep="deal" />);
        expect(screen.getByRole("button", { name: "DEALING HAND #7…" })).toHaveProperty("disabled", true);
    });

    it("renders nothing for a step that is not due", () => {
        render(<StepButtons {...BASE} />);
        expect(screen.queryByRole("button")).toBeNull();
    });
});
