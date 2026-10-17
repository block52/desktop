import type { WithdrawalActivityItem } from "../hooks/useWithdrawalActivity";

/** The USDC (micro units) still on its way out: pending requests that Ethereum has not paid yet. */
export function pendingWithdrawalMicro(items: WithdrawalActivityItem[], paidOut: ReadonlySet<string>): string {
    return items
        .filter(item => item.status === "pending" && !paidOut.has(item.nonce))
        .reduce((sum, item) => sum + BigInt(item.amountMicro), 0n)
        .toString();
}
