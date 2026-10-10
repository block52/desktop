import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("copyText", () => {
    it("writes the text to the clipboard and returns true", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });

        const result = await copyText("b52abc");

        expect(writeText).toHaveBeenCalledWith("b52abc");
        expect(result).toBe(true);
    });

    it("returns false when the clipboard write rejects", async () => {
        vi.stubGlobal("navigator", {
            clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }
        });

        expect(await copyText("b52abc")).toBe(false);
    });

    it("returns false when navigator.clipboard is unavailable", async () => {
        vi.stubGlobal("navigator", {});

        expect(await copyText("b52abc")).toBe(false);
    });
});
