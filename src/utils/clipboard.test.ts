// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("copyText", () => {
    it("writes the text to the clipboard and returns true", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });

        const result = await copyText("b52abc");

        expect(writeText).toHaveBeenCalledWith("b52abc");
        expect(result).toBe(true);
    });

    it("falls back to selecting and copying when the async clipboard write is refused", async () => {
        vi.stubGlobal("navigator", {
            clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }
        });
        const exec = vi.fn(() => true);
        document.execCommand = exec;

        expect(await copyText("b52abc")).toBe(true);
        expect(exec).toHaveBeenCalledWith("copy");
        expect(document.querySelector("textarea")).toBeNull();
    });

    it("returns false when the clipboard write rejects and the fallback fails too", async () => {
        vi.stubGlobal("navigator", {
            clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }
        });
        document.execCommand = vi.fn(() => false);

        expect(await copyText("b52abc")).toBe(false);
    });

    it("returns false when navigator.clipboard is unavailable and nothing else can copy", async () => {
        vi.stubGlobal("navigator", {});
        document.execCommand = vi.fn(() => {
            throw new Error("unsupported");
        });

        expect(await copyText("b52abc")).toBe(false);
    });
});
