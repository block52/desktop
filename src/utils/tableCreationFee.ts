/** The table creation fee, in big blinds (block52/pokerchain#378). */
export const CREATION_FEE_BIG_BLINDS = 10n;

/**
 * Micro-USDC the chain debits to create a table (mirrors the web app's computeTableCreationFeeMicro):
 *   - Cash: 10 × big blind (micro-USDC).
 *   - Sit & Go: blinds are chips, so floor(10 × big blind × buy-in ÷ starting stack).
 * Returns null when the chain cannot price it (zero big blind or starting stack).
 */
export function computeTableCreationFeeMicro(
    isSitAndGo: boolean,
    bigBlindUnits: bigint,
    buyInMicro: bigint,
    startingStack: bigint | null
): bigint | null {
    if (bigBlindUnits <= 0n) return null;
    const fee = CREATION_FEE_BIG_BLINDS * bigBlindUnits;
    if (!isSitAndGo) return fee;
    if (startingStack === null || startingStack <= 0n) return null;
    return (fee * buyInMicro) / startingStack;
}
