import { BigUnit } from "bigunit";

export const convertAmountToBigInt = (amount: string, decimals: number): bigint => {
    if (!decimals || !amount || !+amount) return BigInt(0);
    return BigUnit.from(+amount, decimals).toBigInt();
};
