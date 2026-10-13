const STORAGE_COSMOS_MNEMONIC = "user_cosmos_mnemonic";
const STORAGE_COSMOS_ADDRESS = "user_cosmos_address";

// In the desktop app the seed phrase is kept encrypted by the main process; the page only holds the
// decrypted copy in memory while the wallet is unlocked. In a plain browser (dev, tests) it falls back
// to localStorage.
let unlockedMnemonic: string | null = null;

function vaultBridge() {
    return window.electronAPI?.wallet;
}

export const getCosmosMnemonic = (): string | null =>
    vaultBridge() === undefined ? localStorage.getItem(STORAGE_COSMOS_MNEMONIC) : unlockedMnemonic;

export const getCosmosAddress = (): string | null =>
    localStorage.getItem(STORAGE_COSMOS_ADDRESS);

export const setCosmosMnemonic = async (mnemonic: string): Promise<void> => {
    const bridge = vaultBridge();
    if (bridge === undefined) {
        localStorage.setItem(STORAGE_COSMOS_MNEMONIC, mnemonic);
        return;
    }
    await bridge.saveMnemonic(mnemonic);
    unlockedMnemonic = mnemonic;
};

export const setCosmosAddress = (address: string): void =>
    localStorage.setItem(STORAGE_COSMOS_ADDRESS, address);

export const clearCosmosData = async (): Promise<void> => {
    await vaultBridge()?.clear();
    unlockedMnemonic = null;
    localStorage.removeItem(STORAGE_COSMOS_MNEMONIC);
    localStorage.removeItem(STORAGE_COSMOS_ADDRESS);
};

export function setUnlockedMnemonic(mnemonic: string | null): void {
    unlockedMnemonic = mnemonic;
}

export function legacyStoredMnemonic(): string | null {
    return localStorage.getItem(STORAGE_COSMOS_MNEMONIC);
}

export function removeLegacyStoredMnemonic(): void {
    localStorage.removeItem(STORAGE_COSMOS_MNEMONIC);
}
