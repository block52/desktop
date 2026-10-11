import { useState } from "react";

function wasDismissedBefore(key: string): boolean {
    try {
        return localStorage.getItem(key) === "true";
    } catch {
        return false;
    }
}

/** Whether the player has already closed this Sit & Go's result sheet (remembered per table and wallet on this device). */
export function useSngResultDismissal(tableId: string, address: string | null): { isDismissed: boolean; dismiss: () => void } {
    const key = `viewed_sng_result_${tableId}_${address === null ? "" : address}`;
    const [dismissedKeys, setDismissedKeys] = useState<Record<string, boolean>>({});

    const dismiss = (): void => {
        try {
            localStorage.setItem(key, "true");
        } catch {
            // Not remembered across reloads.
        }
        setDismissedKeys(previous => ({ ...previous, [key]: true }));
    };

    return { isDismissed: dismissedKeys[key] === true || wasDismissedBefore(key), dismiss };
}
