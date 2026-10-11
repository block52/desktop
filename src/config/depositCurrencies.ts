import btcLogo from "../assets/crypto/btc.svg";
import ethLogo from "../assets/crypto/eth.svg";
import usdtLogo from "../assets/crypto/usdt.svg";
import usdcLogo from "../assets/crypto/usdc.svg";
import { ETH_USDC_ADDRESS, ETH_USDT_ADDRESS } from "./constants";

/**
 * The crypto options offered through the NOWPayments flow. `code` is the pay-currency ticker the payment
 * service expects (USDT on Ethereum is `usdterc20`; USDC is plain `usdc`).
 */
export interface DepositCurrency {
    code: string;
    symbol: string;
    name: string;
    network: string;
    logo: string;
    /** ERC-20 tokens: the payment QR becomes an EIP-681 token transfer on this contract. */
    erc20?: { contract: string; decimals: number };
}

export const DEPOSIT_CURRENCIES: readonly DepositCurrency[] = [
    { code: "btc", symbol: "BTC", name: "Bitcoin", network: "Bitcoin Network", logo: btcLogo },
    { code: "eth", symbol: "ETH", name: "Ethereum", network: "Ethereum Network", logo: ethLogo },
    { code: "usdterc20", symbol: "USDT", name: "Tether", network: "Ethereum (ERC-20)", logo: usdtLogo, erc20: { contract: ETH_USDT_ADDRESS, decimals: 6 } },
    { code: "usdc", symbol: "USDC", name: "USD Coin", network: "Ethereum (ERC-20)", logo: usdcLogo, erc20: { contract: ETH_USDC_ADDRESS, decimals: 6 } }
];

/** Look up an offered currency by ticker, case-insensitively (the service echoes it in either case). */
export function findDepositCurrency(code: string): DepositCurrency | undefined {
    const key = code.toLowerCase();
    return DEPOSIT_CURRENCIES.find(currency => currency.code === key);
}
