import { BigUnit } from "bigunit";
import { COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";

export const convertAmountToBigInt = (amount: string, decimals: number): bigint => {
    if (!decimals || !amount || !+amount) return BigInt(0);
    return BigUnit.from(+amount, decimals).toBigInt();
};

/**
 * Parse a decimal USDC string to micro-units, exactly.
 *
 * Prefer this over float-based conversion wherever the amount originates as
 * text — user input, form state, an API field. It never constructs a float,
 * so there is no precision to lose: the digits are moved and the result is
 * built from them. `2.01` is not representable in binary; the nearest double
 * times 10^6 is 2009999.9999999998, and flooring that yields 2009999 instead
 * of 2010000 — converting to bigint afterwards is too late.
 *
 * @param value Decimal USDC as text, e.g. "2.01". Up to 6 decimal places.
 * @returns Amount in micro-units, e.g. 2010000n
 * @throws If the value is not a plain non-negative decimal, or carries more
 *         precision than USDC has. It refuses rather than truncating, because
 *         silently dropping a digit is silently taking money.
 */
export function parseUsdcToMicro(value: string): bigint {
    const text = (value ?? "").trim().replace(/^\+/, "");
    if (text === "") {
        throw new Error("parseUsdcToMicro: amount is empty");
    }
    if (text.startsWith("-")) {
        throw new Error(`parseUsdcToMicro: amount cannot be negative (got "${value}")`);
    }
    // Deliberately strict: no exponents, no thousands separators, no currency
    // symbols. Callers should validate and normalise their own input rather
    // than have this quietly reinterpret it.
    if (!/^\d*\.?\d*$/.test(text) || text === ".") {
        throw new Error(`parseUsdcToMicro: "${value}" is not a valid decimal amount`);
    }

    const [whole = "", fraction = ""] = text.split(".");
    if (fraction.length > COSMOS_CONSTANTS.USDC_DECIMALS) {
        throw new Error(
            `parseUsdcToMicro: "${value}" has more than ${COSMOS_CONSTANTS.USDC_DECIMALS} decimal places, which USDC cannot represent`
        );
    }

    // Right-pad the fraction to exactly 6 digits and concatenate: no arithmetic
    // on anything that could round.
    return BigInt(`${whole || "0"}${fraction.padEnd(COSMOS_CONSTANTS.USDC_DECIMALS, "0")}`);
}

/** Micro-USDC → exact decimal text ("1500000" → "1.5"), no float math. Inverse of parseUsdcToMicro. */
export function microToDecimal(micro: bigint): string {
    const whole = micro / 1_000_000n;
    const fraction = (micro % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
    return fraction === "" ? whole.toString() : `${whole}.${fraction}`;
}

/** Signed micro-USDC integer (indexer money fields) as "$1,234.56" / "-$12.00". */
export function formatMicroUsd(micro: number): string {
    const abs = BigInt(Math.trunc(Math.abs(micro)));
    const whole = (abs / 1_000_000n).toLocaleString();
    const cents = ((abs % 1_000_000n) / 10_000n).toString().padStart(2, "0");
    return `${micro < 0 ? "-" : ""}$${whole}.${cents}`;
}
