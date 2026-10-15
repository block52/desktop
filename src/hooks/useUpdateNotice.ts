import { useCallback, useEffect, useState } from "react";
import type { UpdateInfo } from "../updates/updateCheck";

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const DISMISSED_KEY = "block52.update.dismissedVersion";

function readDismissed(): string | null {
    try {
        return window.localStorage.getItem(DISMISSED_KEY);
    } catch {
        return null;
    }
}

/** The newer release, if there is one the user has not dismissed. Checks at start and every few hours. */
export function useUpdateNotice(): { update: UpdateInfo | null; download: () => void; dismiss: () => void } {
    const [found, setFound] = useState<UpdateInfo | null>(null);
    const [dismissed, setDismissed] = useState<string | null>(readDismissed);

    useEffect(() => {
        const updates = window.electronAPI?.updates;
        if (updates === undefined) return;
        let cancelled = false;

        const check = async () => {
            const result = await updates.check();
            if (!cancelled) setFound(result);
        };

        void check();
        const interval = setInterval(() => void check(), CHECK_EVERY_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    const download = useCallback(() => {
        if (found !== null) window.electronAPI?.updates?.open(found.version);
    }, [found]);

    const dismiss = useCallback(() => {
        if (found === null) return;
        setDismissed(found.version);
        try {
            window.localStorage.setItem(DISMISSED_KEY, found.version);
        } catch {
            // the notice is simply hidden until the next start
        }
    }, [found]);

    const update = found !== null && found.version !== dismissed ? found : null;
    return { update, download, dismiss };
}
