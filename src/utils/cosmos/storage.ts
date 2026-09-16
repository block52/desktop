const STORAGE_COSMOS_MNEMONIC = "user_cosmos_mnemonic";
const STORAGE_COSMOS_ADDRESS = "user_cosmos_address";

export const getCosmosMnemonic = (): string | null =>
    localStorage.getItem(STORAGE_COSMOS_MNEMONIC);

export const getCosmosAddress = (): string | null =>
    localStorage.getItem(STORAGE_COSMOS_ADDRESS);

export const setCosmosMnemonic = (mnemonic: string): void =>
    localStorage.setItem(STORAGE_COSMOS_MNEMONIC, mnemonic);

export const setCosmosAddress = (address: string): void =>
    localStorage.setItem(STORAGE_COSMOS_ADDRESS, address);

export const clearCosmosData = (): void => {
    localStorage.removeItem(STORAGE_COSMOS_MNEMONIC);
    localStorage.removeItem(STORAGE_COSMOS_ADDRESS);
};
