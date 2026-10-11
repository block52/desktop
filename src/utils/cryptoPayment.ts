import { findDepositCurrency } from "../config/depositCurrencies";

/** The payment proxy that fronts NOWPayments (creates payments, reports status, bridges the USDC). */
export function getPaymentProxyUrl(): string {
    const configured: unknown = import.meta.env.VITE_PAYMENT_PROXY_URL;
    return typeof configured === "string" && configured !== "" ? configured.replace(/\/+$/, "") : "https://poker-vm-proxy-js-ixe4h.ondigitalocean.app";
}

export const MIN_CRYPTO_DEPOSIT_USD = 10;

export interface CreatedPayment {
    paymentId: string;
    payAddress: string;
    payAmount: number;
    payCurrency: string;
    priceAmount: number;
    expiresAt: string;
}

export type PaymentStatusName = "waiting" | "confirming" | "confirmed" | "sending" | "finished" | "failed" | "refunded" | "expired";

export interface PaymentStatus {
    status: PaymentStatusName;
    actuallyPaid: number | null;
    outcomeAmount: number | null;
    bridgeTxHash: string | null;
}

export const TERMINAL_PAYMENT_STATUSES: readonly PaymentStatusName[] = ["finished", "failed", "refunded", "expired"];

export const PAYMENT_STATUS_MESSAGES: Record<PaymentStatusName, string> = {
    waiting: "Waiting for your payment…",
    confirming: "Payment detected — confirming on the blockchain…",
    confirmed: "Payment confirmed — converting to USDC…",
    sending: "Sending USDC to your wallet…",
    finished: "Complete — USDC deposited to your game wallet.",
    failed: "Payment failed. Please contact support.",
    refunded: "Payment refunded.",
    expired: "Payment expired. Start a new one."
};

interface CreateResponse {
    success?: boolean;
    error?: string;
    payment_id?: string;
    pay_address?: string;
    pay_amount?: number;
    pay_currency?: string;
    price_amount?: number;
    expires_at?: string;
}

interface StatusResponse {
    success?: boolean;
    payment?: {
        payment_status?: string;
        actually_paid?: number;
        outcome_amount?: number;
        bridge_tx_hash?: string;
    };
}

function isPaymentStatusName(value: string): value is PaymentStatusName {
    return value in PAYMENT_STATUS_MESSAGES;
}

export async function createCryptoPayment(args: { amount: number; currency: string; cosmosAddress: string }): Promise<CreatedPayment> {
    const response = await fetch(`${getPaymentProxyUrl()}/api/nowpayments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args)
    });
    const body = (await response.json().catch(() => ({}))) as CreateResponse;
    if (!response.ok || body.success !== true) {
        throw new Error(body.error ?? `Payment service responded ${response.status}`);
    }
    if (
        body.payment_id === undefined ||
        body.pay_address === undefined ||
        body.pay_amount === undefined ||
        body.pay_currency === undefined ||
        body.price_amount === undefined ||
        body.expires_at === undefined
    ) {
        throw new Error("Payment service returned an incomplete payment");
    }
    return {
        paymentId: body.payment_id,
        payAddress: body.pay_address,
        payAmount: body.pay_amount,
        payCurrency: body.pay_currency,
        priceAmount: body.price_amount,
        expiresAt: body.expires_at
    };
}

export async function getCryptoPaymentStatus(paymentId: string, signal?: AbortSignal): Promise<PaymentStatus> {
    const response = await fetch(`${getPaymentProxyUrl()}/api/nowpayments/payment/${encodeURIComponent(paymentId)}`, { signal });
    if (!response.ok) throw new Error(`Payment service responded ${response.status}`);
    const body = (await response.json()) as StatusResponse;
    const payment = body.payment;
    if (body.success !== true || payment === undefined || payment.payment_status === undefined || !isPaymentStatusName(payment.payment_status)) {
        throw new Error("Unexpected payment status response");
    }
    return {
        status: payment.payment_status,
        actuallyPaid: payment.actually_paid ?? null,
        outcomeAmount: payment.outcome_amount ?? null,
        bridgeTxHash: payment.bridge_tx_hash ?? null
    };
}

/** "0.0123" → 12300 for 6 decimals, without floating-point drift. */
export function toSmallestUnit(amount: number, decimals: number): string {
    const [whole, fraction = ""] = amount.toFixed(decimals).split(".");
    return BigInt(`${whole}${fraction.padEnd(decimals, "0").slice(0, decimals)}`).toString();
}

/** The wallet-scannable payment URI for a created payment (BIP21, EIP-681), or the bare address. */
export function paymentQrValue(payment: Pick<CreatedPayment, "payAddress" | "payAmount" | "payCurrency">): string {
    const currency = findDepositCurrency(payment.payCurrency);
    if (currency === undefined) throw new Error(`Unknown deposit currency "${payment.payCurrency}"`);
    if (currency.erc20 !== undefined) {
        return `ethereum:${currency.erc20.contract}@1/transfer?address=${payment.payAddress}&uint256=${toSmallestUnit(payment.payAmount, currency.erc20.decimals)}`;
    }
    if (currency.code === "btc") return `bitcoin:${payment.payAddress}?amount=${payment.payAmount}`;
    if (currency.code === "eth") return `ethereum:${payment.payAddress}?value=${toSmallestUnit(payment.payAmount, 18)}`;
    return payment.payAddress;
}
