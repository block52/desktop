import { useCallback, useEffect, useState } from "react";
import type { PlayerNote } from "../players/types";

/**
 * Batches local player notes for a list of addresses (a players list, a table's
 * seats, a hand's players) into one `players.getMany` call, and refreshes after
 * a mutation. Returns an empty map in a plain browser (no desktop bridge).
 */
export function usePlayerNotes(addresses: string[]): {
    notes: Record<string, PlayerNote>;
    /** False until the first getMany resolves, so callers can tell "loading" from "no note". */
    loaded: boolean;
    refresh: () => void;
} {
    const [notes, setNotes] = useState<Record<string, PlayerNote>>({});
    const [loaded, setLoaded] = useState(false);

    // A stable key so the effect only re-runs when the set of addresses changes,
    // not on every render that rebuilds the array.
    const key = [...new Set(addresses)].sort().join(",");

    const load = useCallback(() => {
        const players = window.electronAPI?.players;
        const list = key === "" ? [] : key.split(",");
        if (players === undefined || list.length === 0) {
            setNotes({});
            setLoaded(true);
            return;
        }
        setLoaded(false);
        players
            .getMany(list)
            .then(map => {
                setNotes(map);
                setLoaded(true);
            })
            .catch(() => {
                setNotes({});
                setLoaded(true);
            });
    }, [key]);

    useEffect(load, [load]);

    return { notes, loaded, refresh: load };
}

const emptyNote = (address: string): PlayerNote => ({ address, nickname: null, notes: null, tags: [], updatedAt: 0 });

/**
 * One player's note, for a profile or a single seat. `note` is null until the
 * data has loaded, so an editor does not seed from an empty placeholder before
 * the stored note arrives; after loading it is the stored note or an empty one.
 */
export function usePlayerNote(address: string | null): { note: PlayerNote | null; refresh: () => void } {
    const { notes, loaded, refresh } = usePlayerNotes(address === null ? [] : [address]);
    if (address === null || !loaded) return { note: null, refresh };
    return { note: notes[address] ?? emptyNote(address), refresh };
}
