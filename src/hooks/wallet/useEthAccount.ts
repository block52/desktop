import { useCallback, useEffect, useState } from "react";
import type { EthBalances } from "../../wallet/types";

/** The Ethereum wallet derived from the seed phrase, as the Wallet page shows it. One instance feeds both cards. */
export interface EthAccount {
    /** False outside the desktop app (no wallet bridge). */
    available: boolean;
    address: string | null;
    balances: EthBalances | null;
    isLoading: boolean;
    error: string;
    refresh: () => Promise<void>;
}

/** Electron prefixes errors that cross IPC with "Error invoking remote method '…': Error: ". Show only the reason. */
function ipcMessage(err: unknown, fallback: string): string {
    const message = err instanceof Error ? err.message : fallback;
    return message.replace(/^Error invoking remote method '[^']*': (Error: )?/, "");
}

export function useEthAccount(): EthAccount {
    const bridge = window.electronAPI?.wallet;
    const [address, setAddress] = useState<string | null>(null);
    const [balances, setBalances] = useState<EthBalances | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const refresh = useCallback(async () => {
        if (bridge === undefined) return;
        setIsLoading(true);
        setError("");
        try {
            const [nextAddress, nextBalances] = await Promise.all([bridge.ethAddress(), bridge.ethBalances()]);
            setAddress(nextAddress);
            setBalances(nextBalances);
        } catch (err) {
            setError(ipcMessage(err, "Could not read the Ethereum wallet."));
        } finally {
            setIsLoading(false);
        }
    }, [bridge]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { available: bridge !== undefined, address, balances, isLoading, error, refresh };
}
