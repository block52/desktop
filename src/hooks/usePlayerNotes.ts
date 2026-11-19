import { useCallback, useEffect, useState } from "react";
import type { PlayerNote } from "../players/types";

/**
 * Batches local player notes for a list of addresses (a players list, a table's
 * seats, a hand's players) into one `players.getMany` call, and refreshes after
 * a mutation. Returns an empty map in a plain browser (no desktop bridge).
 */
export function usePlayerNotes(addresses: string[]): {
    notes: Record<string, PlayerNote>;
    refresh: () => void;
} {
    const [notes, setNotes] = useState<Record<string, PlayerNote>>({});

    // A stable key so the effect only re-runs when the set of addresses changes,
    // not on every render that rebuilds the array.
    const key = [...new Set(addresses)].sort().join(",");

    const load = useCallback(() => {
        const players = window.electronAPI?.players;
        const list = key === "" ? [] : key.split(",");
        if (players === undefined || list.length === 0) {
            setNotes({});
            return;
        }
        players
            .getMany(list)
            .then(setNotes)
            .catch(() => setNotes({}));
    }, [key]);

    useEffect(load, [load]);

    return { notes, refresh: load };
}

/** One player's note, for a profile or a single seat. */
export function usePlayerNote(address: string | null): { note: PlayerNote | null; refresh: () => void } {
    const { notes, refresh } = usePlayerNotes(address === null ? [] : [address]);
    return { note: address === null ? null : (notes[address] ?? { address, nickname: null, notes: null, tags: [], updatedAt: 0 }), refresh };
}
