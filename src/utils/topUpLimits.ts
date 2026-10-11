/** How much a seat can add: bounded by the table's max buy-in headroom and by the wallet. All micro-USDC. */
export function maxTopUpMicro(stack: bigint, maxBuyIn: bigint, walletBalance: bigint): bigint {
    const headroom = maxBuyIn - stack;
    if (headroom <= 0n || walletBalance <= 0n) return 0n;
    return headroom < walletBalance ? headroom : walletBalance;
}
