import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { DEPOSIT_CURRENCIES, findDepositCurrency } from "../../config/depositCurrencies";
import {
    MIN_CRYPTO_DEPOSIT_USD,
    PAYMENT_STATUS_MESSAGES,
    TERMINAL_PAYMENT_STATUSES,
    createCryptoPayment,
    getCryptoPaymentStatus,
    paymentQrValue,
    type CreatedPayment,
    type PaymentStatus
} from "../../utils/cryptoPayment";
import CopyButton from "../copyButton/CopyButton";
import dialog from "./TableDialog.module.css";
import styles from "./CryptoDepositModal.module.css";

const POLL_MS = 10000;

interface CryptoDepositModalProps {
    /** The Block52 address the USDC is minted to. */
    cosmosAddress: string;
    onClose: () => void;
    /** The payment finished: refresh balances. */
    onCompleted: () => void;
}

export const CryptoDepositModal: React.FC<CryptoDepositModalProps> = ({ cosmosAddress, onClose, onCompleted }) => {
    const [currencyCode, setCurrencyCode] = useState(DEPOSIT_CURRENCIES[0].code);
    const [amount, setAmount] = useState("");
    const [payment, setPayment] = useState<CreatedPayment | null>(null);
    const [status, setStatus] = useState<PaymentStatus | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState("");

    const amountNumber = Number(amount);
    const amountValid = Number.isFinite(amountNumber) && amountNumber >= MIN_CRYPTO_DEPOSIT_USD;

    const create = async () => {
        setIsCreating(true);
        setError("");
        try {
            setPayment(await createCryptoPayment({ amount: amountNumber, currency: currencyCode, cosmosAddress }));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create the payment");
        } finally {
            setIsCreating(false);
        }
    };

    const paymentId = payment?.paymentId ?? null;
    const isTerminal = status !== null && TERMINAL_PAYMENT_STATUSES.includes(status.status);
    useEffect(() => {
        if (paymentId === null || isTerminal) return;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const poll = async () => {
            try {
                const next = await getCryptoPaymentStatus(paymentId, controller.signal);
                if (controller.signal.aborted) return;
                setStatus(next);
                if (next.status === "finished") {
                    onCompleted();
                    return;
                }
                if (TERMINAL_PAYMENT_STATUSES.includes(next.status)) return;
            } catch {
                if (controller.signal.aborted) return;
            }
            timer = setTimeout(() => void poll(), POLL_MS);
        };
        void poll();
        return () => {
            controller.abort();
            if (timer !== undefined) clearTimeout(timer);
        };
    }, [paymentId, isTerminal, onCompleted]);

    const currency = payment !== null ? findDepositCurrency(payment.payCurrency) : undefined;

    return (
        <div className={dialog.overlay} onClick={onClose} role="presentation">
            <div className={dialog.modal} role="dialog" aria-modal="true" aria-label="Deposit with crypto" onClick={e => e.stopPropagation()}>
                <h2 className={dialog.title}>Deposit with crypto</h2>

                {payment === null ? (
                    <>
                        <p className={dialog.body}>
                            Pay with BTC, ETH, USDT or USDC. It is converted to USDC and minted to your Block52 wallet. Minimum ${MIN_CRYPTO_DEPOSIT_USD}.
                        </p>
                        <div className={styles.currencies} role="radiogroup" aria-label="Deposit currency">
                            {DEPOSIT_CURRENCIES.map(option => (
                                <button
                                    key={option.code}
                                    type="button"
                                    role="radio"
                                    aria-checked={currencyCode === option.code}
                                    className={`${styles.currency} ${currencyCode === option.code ? styles.currencyOn : ""}`}
                                    onClick={() => setCurrencyCode(option.code)}
                                >
                                    <img src={option.logo} alt="" className={styles.logo} />
                                    <span className={styles.symbol}>{option.symbol}</span>
                                    <span className={styles.network}>{option.network}</span>
                                </button>
                            ))}
                        </div>
                        <label className={dialog.field}>
                            <span className={dialog.fieldLabel}>Amount (USD)</span>
                            <input
                                className={dialog.input}
                                type="number"
                                min={MIN_CRYPTO_DEPOSIT_USD}
                                value={amount}
                                placeholder={`${MIN_CRYPTO_DEPOSIT_USD}.00`}
                                onChange={e => setAmount(e.target.value)}
                            />
                        </label>
                        {error !== "" && <p className={dialog.error}>{error}</p>}
                        <div className={dialog.actions}>
                            <button type="button" className={`btn-ghost ${dialog.action}`} onClick={onClose}>
                                Cancel
                            </button>
                            <button type="button" className={`btn-glow ${dialog.action}`} onClick={() => void create()} disabled={!amountValid || isCreating}>
                                {isCreating ? "Creating…" : "Create payment"}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={dialog.summary}>
                            <span className={dialog.summaryLabel}>Send exactly</span>
                            <span className={dialog.summaryValue}>
                                {payment.payAmount} {currency?.symbol}
                            </span>
                        </div>
                        <p className={dialog.body}>
                            ≈ ${payment.priceAmount.toFixed(2)} USD · only send on {currency?.network}. Anything else is lost.
                        </p>
                        <div className={styles.qr}>
                            <QRCodeSVG value={paymentQrValue(payment)} size={176} level="M" marginSize={2} />
                        </div>
                        <div className={styles.address}>
                            <code>{payment.payAddress}</code>
                            <CopyButton text={payment.payAddress} message="Payment address copied" title="Copy payment address" />
                        </div>
                        <p className={status?.status === "failed" || status?.status === "expired" ? dialog.error : dialog.body}>
                            {PAYMENT_STATUS_MESSAGES[status?.status ?? "waiting"]}
                        </p>
                        {status?.outcomeAmount !== null && status?.outcomeAmount !== undefined && (
                            <p className={dialog.body}>You receive ${status.outcomeAmount.toFixed(2)} USDC.</p>
                        )}
                        <div className={dialog.actions}>
                            <button type="button" className={`btn-ghost ${dialog.action}`} onClick={onClose}>
                                {isTerminal ? "Done" : "Close (keeps running)"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CryptoDepositModal;
