// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { PlayerNote } from "../players/types";
import { usePlayerNote } from "./usePlayerNotes";

const NOTE: PlayerNote = { address: "b52x", nickname: "Pup", notes: null, tags: [], updatedAt: 1 };

afterEach(() => {
    (window as unknown as { electronAPI?: unknown }).electronAPI = undefined;
    vi.restoreAllMocks();
});

describe("usePlayerNote", () => {
    it("is null until loaded, then the stored note (not an empty placeholder)", async () => {
        let resolve: (v: Record<string, PlayerNote>) => void = () => undefined;
        const getMany = vi.fn(() => new Promise<Record<string, PlayerNote>>(r => (resolve = r)));
        (window as unknown as { electronAPI: unknown }).electronAPI = { players: { getMany } };

        const { result } = renderHook(() => usePlayerNote("b52x"));
        // Before the fetch resolves, the editor must not seed from a default.
        expect(result.current.note).toBeNull();

        resolve({ b52x: NOTE });
        await waitFor(() => expect(result.current.note?.nickname).toBe("Pup"));
    });

    it("after loading, a player with no stored note gets an empty note (not null)", async () => {
        const getMany = vi.fn(async () => ({}));
        (window as unknown as { electronAPI: unknown }).electronAPI = { players: { getMany } };

        const { result } = renderHook(() => usePlayerNote("b52y"));
        await waitFor(() => expect(result.current.note).not.toBeNull());
        expect(result.current.note?.nickname).toBeNull();
        expect(result.current.note?.tags).toEqual([]);
    });

    it("is null in a plain browser (no bridge) only until it settles to an empty note", async () => {
        const { result } = renderHook(() => usePlayerNote("b52z"));
        await waitFor(() => expect(result.current.note).not.toBeNull());
        expect(result.current.note?.nickname).toBeNull();
    });
});
