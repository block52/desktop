import { ETH_USDC_ADDRESS, ETH_USDT_ADDRESS, ETH_WBTC_ADDRESS } from "./constants";
import type { EthBalances } from "../wallet/types";

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

/**
 * A short form for a glance: at most `maxDecimals` decimals, cut rather than rounded so it never shows more than is
 * held, and "<0.0001" (for 4 decimals) for a non-zero amount that would otherwise read as 0.
 */
export function formatShort(amount: bigint, decimals: number, maxDecimals: number): string {
    if (amount === 0n) return "0";
    const [whole, fraction = ""] = formatUnits(amount, decimals).split(".");
    const cut = fraction.slice(0, maxDecimals).replace(/0+$/, "");
    if (whole === "0" && cut === "") return `<0.${"0".repeat(Math.max(0, maxDecimals - 1))}1`;
    return cut === "" ? whole : `${whole}.${cut}`;
}

const HOLDING_DECIMALS: Record<"ETH" | "USDT" | "wBTC", number> = { ETH: 4, USDT: 2, wBTC: 6 };

/** What the Ethereum wallet holds besides USDC, non-zero amounts only, e.g. ["0.02 ETH", "10 USDT"]. */
export function otherHoldings(balances: EthBalances): string[] {
    const amounts: Array<["ETH" | "USDT" | "wBTC", bigint]> = [
        ["ETH", balances.eth],
        ["USDT", balances.usdt],
        ["wBTC", balances.wbtc],
    ];
    return amounts
        .filter(([, amount]) => amount > 0n)
        .map(([symbol, amount]) => {
            const asset = ETH_ASSETS.find(entry => entry.symbol === symbol);
            if (asset === undefined) throw new Error(`Unknown asset ${symbol}`);
            return `${formatShort(amount, asset.decimals, HOLDING_DECIMALS[symbol])} ${symbol}`;
        });
}
