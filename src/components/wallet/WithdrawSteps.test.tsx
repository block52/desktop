// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import WithdrawSteps from "./WithdrawSteps";

describe("WithdrawSteps", () => {
    afterEach(cleanup);

    it("marks the validator step as current while waiting for the signature", () => {
        render(<WithdrawSteps stage="waiting_sig" />);
        const current = screen.getAllByRole("listitem").filter(item => item.getAttribute("aria-current") === "step");
        expect(current).toHaveLength(1);
        expect(current[0].textContent).toContain("Validator signature");
    });

    it("makes the Ethereum step the current one once the signature is ready", () => {
        render(<WithdrawSteps stage="ready" />);
        const current = screen.getAllByRole("listitem").find(item => item.getAttribute("aria-current") === "step");
        expect(current?.textContent).toContain("Complete on Ethereum");
    });
});
