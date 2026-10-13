import { requireWalletBridge } from "./walletBridge";

/**
 * The address stored next to the wallet is just a string in local storage. Before money is pointed at an
 * address (deposit receiver), ask the wallet for the address it really holds and refuse if the two differ.
 */
export async function assertAddressMatchesWallet(address: string): Promise<void> {
    const derived = await requireWalletBridge().getAddress();
    if (derived !== address) {
        throw new Error("The wallet address on screen does not match your seed phrase. Reload the app and try again.");
    }
}
