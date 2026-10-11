// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "../../context/ToastContext";
import CopyButton from "./CopyButton";

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("CopyButton", () => {
    it("copies its text and shows a success toast on click", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });

        render(
            <ToastProvider>
                <CopyButton text="b52abc123" message="Address copied" />
            </ToastProvider>
        );

        fireEvent.click(screen.getByRole("button", { name: "Copy" }));

        expect(writeText).toHaveBeenCalledWith("b52abc123");
        expect((await screen.findByText("Address copied"))).toBeTruthy();
    });
});
