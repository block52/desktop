export const ETH_CHAIN_ID = 1;
export const ETH_USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
export const ETH_USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
export const ETH_WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";

/**
 * Gasless USDC deposits: the contract that receives a signed USDC authorization, and the service that submits it and
 * pays the network fee. Both stay null until they are live; with either unset the wallet deposits from the user's own
 * ETH as before. Overridable at build time for testing.
 */
export const GASLESS_DEPOSITOR_ADDRESS: string | null = "0xF2e703BEC24fA942095437B00Bb06eA73e11b778";
export const GASLESS_RELAYER_URL: string | null = null;
