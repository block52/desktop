import { useEffect, useState } from "react";
import { useNetwork } from "../context/NetworkContext";
import { getCosmosClient } from "../utils/cosmos/client";

const POLL_INTERVAL_MS = 5000;

export interface BlockHeights {
    /** The first height seen since polling began. */
    first: number | null;
    latest: number | null;
}

/** The first and latest Block52 block height of the current network, polled while `active`; null until known. */
export function useBlockHeight(active: boolean): BlockHeights {
    const { currentNetwork } = useNetwork();
    const [heights, setHeights] = useState<BlockHeights>({ first: null, latest: null });

    useEffect(() => {
        if (!active) return;
        let cancelled = false;
        const poll = async () => {
            try {
                const client = getCosmosClient({ rpc: currentNetwork.rpc, rest: currentNetwork.rest });
                if (!client) return;
                const blocks = await client.getLatestBlocks(1);
                if (cancelled || blocks.length === 0) return;
                const latest = Number(blocks[0].block.header.height);
                setHeights(previous => ({ first: previous.first ?? latest, latest }));
            } catch {
                // The next poll tries again; the progress bar simply waits.
            }
        };
        void poll();
        const timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [active, currentNetwork]);

    return heights;
}
