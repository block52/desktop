/** Validators pick up Ethereum deposits at every height that is a multiple of this (x/poker deposit_sync.go). */
export const BRIDGE_SYNC_INTERVAL = 50;

export interface MintProgress {
    /** The next sync height after the deposit was seen. */
    target: number;
    blocksLeft: number;
    /** 0 to 100, from the height the deposit was first seen to the sync height. */
    percent: number;
    reached: boolean;
}

/** The first sync height strictly after this one. */
export function nextSyncHeight(height: number): number {
    return (Math.floor(height / BRIDGE_SYNC_INTERVAL) + 1) * BRIDGE_SYNC_INTERVAL;
}

/** How far the chain has come toward the sync that will pick up a deposit seen at `startHeight`. */
export function mintProgress(startHeight: number, currentHeight: number): MintProgress {
    const target = nextSyncHeight(startHeight);
    const span = target - startHeight;
    const done = Math.min(Math.max(currentHeight - startHeight, 0), span);
    return { target, blocksLeft: Math.max(target - currentHeight, 0), percent: Math.round((done / span) * 100), reached: currentHeight >= target };
}
