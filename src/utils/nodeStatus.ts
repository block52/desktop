export interface NodeStatus {
    online: boolean;
    moniker: string | null;
    nodeVersion: string | null;
    cosmosSdkVersion: string | null;
    chainId: string | null;
    blockHeight: string | null;
    blockTime: string | null;
    syncing: boolean;
}

interface NodeInfoResponse {
    default_node_info?: { network?: string; moniker?: string };
    application_version?: { version?: string; cosmos_sdk_version?: string };
}

interface LatestBlockResponse {
    block?: { header?: { height?: string; time?: string; chain_id?: string } };
    sdk_block?: { header?: { height?: string; time?: string; chain_id?: string } };
}

interface SyncingResponse {
    syncing?: boolean;
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
}

/** Combine the three node endpoints into one status; "online" means at least one of them answered. */
export function buildNodeStatus(info: NodeInfoResponse | null, block: LatestBlockResponse | null, syncing: SyncingResponse | null): NodeStatus {
    const header = block?.block?.header ?? block?.sdk_block?.header;
    return {
        online: info !== null || block !== null,
        moniker: info?.default_node_info?.moniker ?? null,
        nodeVersion: info?.application_version?.version ?? null,
        cosmosSdkVersion: info?.application_version?.cosmos_sdk_version ?? null,
        chainId: header?.chain_id ?? info?.default_node_info?.network ?? null,
        blockHeight: header?.height ?? null,
        blockTime: header?.time ?? null,
        syncing: syncing?.syncing === true
    };
}

export async function fetchNodeStatus(rest: string, signal: AbortSignal): Promise<NodeStatus> {
    const base = rest.replace(/\/+$/, "");
    const [info, block, syncing] = await Promise.allSettled([
        getJson<NodeInfoResponse>(`${base}/cosmos/base/tendermint/v1beta1/node_info`, signal),
        getJson<LatestBlockResponse>(`${base}/cosmos/base/tendermint/v1beta1/blocks/latest`, signal),
        getJson<SyncingResponse>(`${base}/cosmos/base/tendermint/v1beta1/syncing`, signal)
    ]);
    return buildNodeStatus(
        info.status === "fulfilled" ? info.value : null,
        block.status === "fulfilled" ? block.value : null,
        syncing.status === "fulfilled" ? syncing.value : null
    );
}

/** "3d 4h 12m" / "4h 12m" / "12m" / "8s" since an ISO timestamp. */
export function formatSince(isoTime: string, now: number): string {
    const diff = Math.max(0, now - new Date(isoTime).getTime());
    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${Math.floor(diff / 1000)}s`;
}
