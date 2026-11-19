// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ModalErrorBoundary from "./ModalErrorBoundary";

function Broken(): never {
    throw new Error("boom");
}

afterEach(cleanup);

describe("ModalErrorBoundary", () => {
    it("shows its children when nothing fails", () => {
        render(
            <ModalErrorBoundary onClose={vi.fn()}>
                <p>fine</p>
            </ModalErrorBoundary>
        );
        expect(screen.getByText("fine")).toBeTruthy();
    });

    it("replaces a failing dialog with a close button instead of crashing the app", () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const onClose = vi.fn();
        render(
            <ModalErrorBoundary onClose={onClose}>
                <Broken />
            </ModalErrorBoundary>
        );
        fireEvent.click(screen.getByText("Close"));
        expect(onClose).toHaveBeenCalledOnce();
    });
});
