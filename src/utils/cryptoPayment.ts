import { findDepositCurrency } from "../config/depositCurrencies";

const DEFAULT_PAYMENT_PROXY_URL = "https://poker-vm-proxy-js-ixe4h.ondigitalocean.app";

/** The payment proxy that fronts NOWPayments (creates payments, reports status, bridges the USDC). */
export function getPaymentProxyUrl(): string {
    const configured: unknown = import.meta.env.VITE_PAYMENT_PROXY_URL;
    if (typeof configured !== "string" || configured === "") return DEFAULT_PAYMENT_PROXY_URL;
    const url = new URL(configured);
    // Payment details come from this host, so it must be encrypted (plain http only for a local dev proxy).
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) {
        throw new Error("VITE_PAYMENT_PROXY_URL must be an https URL");
    }
    return configured.replace(/\/+$/, "");
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
    const payment: CreatedPayment = {
        paymentId: body.payment_id,
        payAddress: body.pay_address,
        payAmount: body.pay_amount,
        payCurrency: body.pay_currency,
        priceAmount: body.price_amount,
        expiresAt: body.expires_at
    };
    assertPaymentMatchesRequest(payment, args);
    return payment;
}

const BITCOIN_ADDRESS = /^(bc1[ac-hj-np-z02-9]{11,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * The payment service chooses the address the user is told to send funds to. Refuse anything that does not
 * look like what was asked for (same currency, same USD price, an address of the right shape, a future
 * expiry), so a faulty or compromised service cannot silently redirect a deposit.
 */
function assertPaymentMatchesRequest(payment: CreatedPayment, request: { amount: number; currency: string }): void {
    const currency = findDepositCurrency(request.currency);
    const addressMatches = currency === undefined ? false : currency.code === "btc" ? BITCOIN_ADDRESS.test(payment.payAddress) : EVM_ADDRESS.test(payment.payAddress);
    const matches =
        currency !== undefined &&
        payment.payCurrency.toLowerCase() === currency.code &&
        Number.isFinite(payment.priceAmount) &&
        Math.abs(payment.priceAmount - request.amount) <= 0.01 &&
        Number.isFinite(payment.payAmount) &&
        payment.payAmount > 0 &&
        addressMatches &&
        Number.isFinite(Date.parse(payment.expiresAt)) &&
        Date.parse(payment.expiresAt) > Date.now();
    if (!matches) {
        throw new Error("The payment service returned details that do not match your request. Do not send any funds — try again later.");
    }
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
