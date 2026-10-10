// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { normalizeReleaseNote, RELEASE_NOTES_URL, useReleaseNotes } from "./useReleaseNotes";

const FULL_NOTE = {
    id: "weekly-2026-W41",
    date: "2026-10-07",
    title: "Self-service node & validator onboarding",
    version: "v1.5.1",
    tags: ["poker-vm@sdk-v1.5.1", "weekly"],
    highlights: ["Shipped onboarding"],
    features: ["Feature A"],
    bugFixes: ["Fix B"],
    improvements: ["Improvement C"],
    tests: ["Test D"],
    body: ""
};

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("normalizeReleaseNote", () => {
    it("maps all sections with defaults", () => {
        expect(normalizeReleaseNote(FULL_NOTE)).toEqual({
            id: "weekly-2026-W41",
            date: "2026-10-07",
            title: "Self-service node & validator onboarding",
            version: "v1.5.1",
            tags: ["poker-vm@sdk-v1.5.1", "weekly"],
            highlights: ["Shipped onboarding"],
            features: ["Feature A"],
            bugFixes: ["Fix B"],
            improvements: ["Improvement C"],
            tests: ["Test D"],
            body: ""
        });
    });

    it("defaults optional fields and drops malformed entries", () => {
        expect(normalizeReleaseNote({ id: "x", date: "2026-01-01", title: "T" })).toEqual({
            id: "x",
            date: "2026-01-01",
            title: "T",
            version: null,
            tags: [],
            highlights: [],
            features: [],
            bugFixes: [],
            improvements: [],
            tests: [],
            body: ""
        });
        expect(normalizeReleaseNote({})).toBeNull();
        expect(normalizeReleaseNote(null)).toBeNull();
    });
});

describe("useReleaseNotes", () => {
    it("fetches and normalizes the release notes feed", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [FULL_NOTE, { id: "y", date: "2026-09-01", title: "Older note" }]
        });
        vi.stubGlobal("fetch", fetchMock);

        const { result } = renderHook(() => useReleaseNotes());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(fetchMock).toHaveBeenCalledWith(RELEASE_NOTES_URL);
        expect(result.current.error).toBe("");
        expect(result.current.notes.map(n => n.id)).toEqual(["weekly-2026-W41", "y"]);
        expect(result.current.notes[0].bugFixes).toEqual(["Fix B"]);
    });

    it("sets an error when the fetch fails and reload refetches", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 503 })
            .mockResolvedValueOnce({ ok: true, json: async () => [FULL_NOTE] });
        vi.stubGlobal("fetch", fetchMock);

        const { result } = renderHook(() => useReleaseNotes());
        await waitFor(() => expect(result.current.error).not.toBe(""));
        expect(result.current.notes).toEqual([]);

        await act(async () => {
            result.current.reload();
        });
        await waitFor(() => expect(result.current.notes.length).toBe(1));
        expect(result.current.error).toBe("");
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
