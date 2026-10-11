import { useEffect, useState } from "react";
import { useNetwork } from "../context/NetworkContext";
import { queryNftAvatar, type OnChainNftAvatar } from "../utils/nftAvatar";

/** The NFT avatar registered on chain for a Block52 address (null when none). `refreshKey` forces a re-read. */
export function useOnChainAvatar(cosmosAddress: string | null, refreshKey: number): OnChainNftAvatar | null {
    const { currentNetwork } = useNetwork();
    const [result, setResult] = useState<{ key: string; avatar: OnChainNftAvatar | null } | null>(null);
    const key = cosmosAddress === null ? "" : `${cosmosAddress}|${currentNetwork.rest}|${refreshKey}`;

    useEffect(() => {
        if (cosmosAddress === null) return;
        const controller = new AbortController();
        queryNftAvatar(currentNetwork.rest, cosmosAddress, controller.signal)
            .then(avatar => setResult({ key, avatar }))
            .catch(() => {
                if (!controller.signal.aborted) setResult({ key, avatar: null });
            });
        return () => controller.abort();
    }, [cosmosAddress, currentNetwork.rest, key]);

    return result !== null && result.key === key ? result.avatar : null;
}
