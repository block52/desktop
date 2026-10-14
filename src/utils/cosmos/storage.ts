const STORAGE_COSMOS_MNEMONIC = "user_cosmos_mnemonic";
const STORAGE_COSMOS_ADDRESS = "user_cosmos_address";

// The seed phrase lives encrypted in the main process. Only the (public) address is kept here.
export const getCosmosAddress = (): string | null =>
    localStorage.getItem(STORAGE_COSMOS_ADDRESS);

export const setCosmosAddress = (address: string): void =>
    localStorage.setItem(STORAGE_COSMOS_ADDRESS, address);

export const clearCosmosData = async (): Promise<void> => {
    await window.electronAPI?.wallet.clear();
    localStorage.removeItem(STORAGE_COSMOS_MNEMONIC);
    localStorage.removeItem(STORAGE_COSMOS_ADDRESS);
};

/** Wallets saved before the vault existed kept the seed phrase here, in the clear. */
export function legacyStoredMnemonic(): string | null {
    return localStorage.getItem(STORAGE_COSMOS_MNEMONIC);
}

export function removeLegacyStoredMnemonic(): void {
    localStorage.removeItem(STORAGE_COSMOS_MNEMONIC);
}
