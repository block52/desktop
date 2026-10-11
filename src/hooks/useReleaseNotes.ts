import { useCallback, useEffect, useState } from "react";

export const RELEASE_NOTES_URL =
    "https://raw.githubusercontent.com/block52/cards/refs/heads/main/release-notes/release-notes.json";

export interface ReleaseNote {
    id: string;
    date: string;
    title: string;
    version: string | null;
    tags: string[];
    highlights: string[];
    features: string[];
    bugFixes: string[];
    improvements: string[];
    tests: string[];
    body: string;
}

function stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === "string");
}

/** Map a raw feed entry to a ReleaseNote; null when id/date/title are missing. */
export function normalizeReleaseNote(raw: unknown): ReleaseNote | null {
    if (typeof raw !== "object" || raw === null) return null;
    const n = raw as Record<string, unknown>;
    if (typeof n.id !== "string" || typeof n.date !== "string" || typeof n.title !== "string") return null;
    return {
        id: n.id,
        date: n.date,
        title: n.title,
        version: typeof n.version === "string" ? n.version : null,
        tags: stringArray(n.tags),
        highlights: stringArray(n.highlights),
        features: stringArray(n.features),
        bugFixes: stringArray(n.bugFixes),
        improvements: stringArray(n.improvements),
        tests: stringArray(n.tests),
        body: typeof n.body === "string" ? n.body : ""
    };
}

export function useReleaseNotes(): { notes: ReleaseNote[]; isLoading: boolean; error: string; reload: () => void } {
    const [notes, setNotes] = useState<ReleaseNote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [nonce, setNonce] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            setError("");
            try {
                const response = await fetch(RELEASE_NOTES_URL);
                if (!response.ok) throw new Error(`Failed to fetch release notes: ${response.status}`);
                const data = await response.json();
                if (cancelled) return;
                const normalized = (Array.isArray(data) ? data : [])
                    .map(normalizeReleaseNote)
                    .filter((n): n is ReleaseNote => n !== null);
                setNotes(normalized);
            } catch (err) {
                if (!cancelled) {
                    setNotes([]);
                    setError(err instanceof Error ? err.message : "Failed to load release notes");
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [nonce]);

    const reload = useCallback(() => setNonce(n => n + 1), []);

    return { notes, isLoading, error, reload };
}
