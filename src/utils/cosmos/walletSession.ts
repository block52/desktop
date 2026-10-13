import type { WalletCredential, WalletStatus } from "../../wallet/types";
import { legacyStoredMnemonic, removeLegacyStoredMnemonic, setUnlockedMnemonic } from "./storage";

/** Loads the decrypted seed into memory and drops the old plaintext copy once the vault is proven to hold the same phrase. */
async function adoptVaultMnemonic(bridge: NonNullable<Window["electronAPI"]>["wallet"]): Promise<void> {
    const mnemonic = await bridge.getMnemonic();
    setUnlockedMnemonic(mnemonic);
    const legacy = legacyStoredMnemonic();
    if (legacy !== null && mnemonic === legacy) removeLegacyStoredMnemonic();
}

/** Called once at startup. Returns null when running outside the desktop app. */
export async function openWalletSession(): Promise<WalletStatus | null> {
    const bridge = window.electronAPI?.wallet;
    if (bridge === undefined) return null;

    let status = await bridge.status();
    const legacy = legacyStoredMnemonic();
    if (legacy !== null && !status.exists) {
        await bridge.saveMnemonic(legacy);
        status = await bridge.status();
    }
    if (status.exists && !status.locked) await adoptVaultMnemonic(bridge);
    return status;
}

export async function unlockWalletSession(credential: WalletCredential): Promise<boolean> {
    const bridge = window.electronAPI?.wallet;
    if (bridge === undefined) return true;
    const unlocked = await bridge.unlock(credential);
    if (unlocked) await adoptVaultMnemonic(bridge);
    return unlocked;
}

export function closeWalletSession(): void {
    setUnlockedMnemonic(null);
}
