import type { WalletCredential, WalletStatus } from "../../wallet/types";
import { getCosmosAddress, legacyStoredMnemonic, removeLegacyStoredMnemonic, setCosmosAddress } from "./storage";

type Bridge = NonNullable<Window["electronAPI"]>["wallet"];

/** Moves a seed phrase an older version kept in the clear into the vault, then removes the plaintext copy. */
async function migrateLegacyMnemonic(bridge: Bridge, status: WalletStatus): Promise<void> {
    const legacy = legacyStoredMnemonic();
    if (legacy === null) return;
    if (!status.exists) {
        setCosmosAddress(await bridge.importMnemonic(legacy));
        removeLegacyStoredMnemonic();
        return;
    }
    // A vault already exists (an earlier run copied it). Drop the plaintext once it is proven to be the same wallet.
    if (!status.locked && (await bridge.getAddress()) === getCosmosAddress()) removeLegacyStoredMnemonic();
}

/** Called once at startup. Returns null when running outside the desktop app. */
export async function openWalletSession(): Promise<WalletStatus | null> {
    const bridge = window.electronAPI?.wallet;
    if (bridge === undefined) return null;

    const status = await bridge.status();
    await migrateLegacyMnemonic(bridge, status);
    return bridge.status();
}

export async function unlockWalletSession(credential: WalletCredential): Promise<boolean> {
    const bridge = window.electronAPI?.wallet;
    if (bridge === undefined) return true;
    const unlocked = await bridge.unlock(credential);
    if (unlocked) await migrateLegacyMnemonic(bridge, await bridge.status());
    return unlocked;
}
