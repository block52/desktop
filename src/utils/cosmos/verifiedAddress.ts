import { COSMOS_CONSTANTS, getAddressFromMnemonic } from "@block52/poker-vm-sdk";
import { getCosmosMnemonic } from "./storage";

/**
 * The address stored next to the seed phrase is just a string in local storage. Before money is pointed at an
 * address (deposit receiver), re-derive it from the key and refuse if the two differ.
 */
export async function assertAddressMatchesWallet(address: string): Promise<void> {
    const mnemonic = getCosmosMnemonic();
    if (mnemonic === null || mnemonic === "") {
        throw new Error("Block52 wallet not initialized. Create or import a wallet first.");
    }
    const derived = await getAddressFromMnemonic(mnemonic, COSMOS_CONSTANTS.ADDRESS_PREFIX);
    if (derived !== address) {
        throw new Error("The wallet address on screen does not match your seed phrase. Reload the app and try again.");
    }
}
