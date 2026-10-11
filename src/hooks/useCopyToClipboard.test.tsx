// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { ToastProvider } from "../context/ToastContext";
import { useCopyToClipboard } from "./useCopyToClipboard";

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider>{children}</ToastProvider>
);

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("useCopyToClipboard", () => {
    it("copies the text and shows a success toast", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });

        const { result } = renderHook(() => useCopyToClipboard(), { wrapper });
        let ok = false;
        await act(async () => {
            ok = await result.current("b52abc", "Address copied");
        });

        expect(writeText).toHaveBeenCalledWith("b52abc");
        expect(ok).toBe(true);
        expect(document.body.textContent).toContain("Address copied");
    });

    it("shows an error toast when the copy fails", async () => {
        vi.stubGlobal("navigator", {
            clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }
        });

        const { result } = renderHook(() => useCopyToClipboard(), { wrapper });
        await act(async () => {
            await result.current("b52abc");
        });

        expect(document.body.textContent).toContain("Failed to copy");
    });
});
