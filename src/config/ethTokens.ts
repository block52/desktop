import { ETH_USDC_ADDRESS, ETH_USDT_ADDRESS, ETH_WBTC_ADDRESS } from "./constants";

export type EthAssetSymbol = "ETH" | "USDC" | "USDT" | "wBTC";

export interface EthAsset {
    symbol: EthAssetSymbol;
    name: string;
    decimals: number;
    /** Null for ETH itself. */
    contract: string | null;
}

/** What the Ethereum deposit address can hold. Only USDC and USDT can be sent on to the bridge. */
export const ETH_ASSETS: readonly EthAsset[] = [
    { symbol: "ETH", name: "Ether", decimals: 18, contract: null },
    { symbol: "USDC", name: "USD Coin", decimals: 6, contract: ETH_USDC_ADDRESS },
    { symbol: "USDT", name: "Tether", decimals: 6, contract: ETH_USDT_ADDRESS },
    { symbol: "wBTC", name: "Wrapped Bitcoin", decimals: 8, contract: ETH_WBTC_ADDRESS },
];

/** A smallest-unit amount as a plain decimal string, without trailing zeros. */
export function formatUnits(amount: bigint, decimals: number): string {
    const base = 10n ** BigInt(decimals);
    const whole = amount / base;
    const fraction = (amount % base).toString().padStart(decimals, "0").replace(/0+$/, "");
    return fraction === "" ? whole.toString() : `${whole}.${fraction}`;
}

/** The inverse of formatUnits for a typed amount. Null when it is not a number with at most `decimals` decimals. */
export function parseUnits(text: string, decimals: number): bigint | null {
    const match = /^(\d+)(?:\.(\d*))?$/.exec(text.trim());
    if (match === null) return null;
    const fraction = match[2] ?? "";
    if (fraction.length > decimals) return null;
    const padded = fraction.padEnd(decimals, "0");
    return BigInt(match[1]) * 10n ** BigInt(decimals) + (padded === "" ? 0n : BigInt(padded));
}
