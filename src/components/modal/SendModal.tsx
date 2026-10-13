import React, { useState, useCallback, useMemo } from "react";
import { COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import { isValidBech32Address } from "../../utils/bech32";
import { parseUsdcToMicro } from "../../utils/currency";
import styles from "./SendModal.module.css";

interface SendModalProps {
    fromAddress: string;
    usdcBalance: string;
    onSend: (recipient: string, amountUsdc: string) => Promise<string>;
    onClose: () => void;
}

const SendModal: React.FC<SendModalProps> = ({ usdcBalance, onSend, onClose }) => {
    const [recipient, setRecipient] = useState("");
    const [amount, setAmount] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState("");
    const [txHash, setTxHash] = useState("");
    const [isReviewing, setIsReviewing] = useState(false);

    const numericBalance = useMemo(() => Number(usdcBalance), [usdcBalance]);
    const amountMicro = useMemo(() => {
        try {
            return parseUsdcToMicro(amount);
        } catch {
            return null;
        }
    }, [amount]);
    const numericAmount = amountMicro === null ? 0 : Number(amountMicro) / 1_000_000;

    const isValidRecipient = useMemo(() => isValidBech32Address(recipient, COSMOS_CONSTANTS.ADDRESS_PREFIX), [recipient]);
    const isExceedingBalance = numericAmount > numericBalance;
    const canSend = isValidRecipient && amountMicro !== null && amountMicro > 0n && !isExceedingBalance && !isSending;

    const handleSend = useCallback(async () => {
        setError("");
        setIsSending(true);
        try {
            const hash = await onSend(recipient, amount.trim());
            setTxHash(hash);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Transaction failed");
        } finally {
            setIsSending(false);
        }
    }, [onSend, recipient, amount]);

    const handleOverlayClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    }, [onClose]);

    if (txHash) {
        return (
            <div className={styles.overlay} onClick={handleOverlayClick}>
                <div className={styles.modal}>
                    <div className={styles.header}>
                        <h2 className={styles.title}>Transaction Sent</h2>
                        <button onClick={onClose} className={styles.closeButton}>
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <p className={styles.successText}>
                        Your transaction was submitted successfully.
                    </p>
                    <div className={styles.hashBox}>
                        <p className={styles.hashLabel}>Transaction hash</p>
                        <p className={styles.hashValue}>{txHash}</p>
                    </div>
                    <button onClick={onClose} className={`btn-glow ${styles.primaryButton} ${styles.fullWidth}`}>
                        Done
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.overlay} onClick={handleOverlayClick}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Send USDC</h2>
                    <button onClick={onClose} className={styles.closeButton}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.balanceBox}>
                    <span className={styles.balanceLabel}>Available balance</span>
                    <span className={styles.balanceValue}>${numericBalance.toFixed(2)} USDC</span>
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Recipient Address</label>
                    <input
                        type="text"
                        value={recipient}
                        onChange={e => {
                            setRecipient(e.target.value.trim());
                            setIsReviewing(false);
                        }}
                        placeholder="b521..."
                        className={`${styles.input} ${recipient && !isValidRecipient ? styles.inputError : ""}`}
                        spellCheck={false}
                    />
                    {recipient && !isValidRecipient && (
                        <p className={`${styles.inputHint} ${styles.inputHintError}`}>
                            Not a valid Block52 address (check every character)
                        </p>
                    )}
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Amount (USDC)</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={e => {
                            setAmount(e.target.value);
                            setIsReviewing(false);
                        }}
                        placeholder="0.00"
                        min="0"
                        step="0.000001"
                        className={`${styles.input} ${isExceedingBalance ? styles.inputError : ""}`}
                    />
                    {isExceedingBalance && (
                        <p className={`${styles.inputHint} ${styles.inputHintError}`}>
                            Amount exceeds available balance
                        </p>
                    )}
                </div>

                {isReviewing && (
                    <div className={styles.balanceBox}>
                        <span className={styles.balanceLabel}>
                            Send {amount.trim()} USDC to this address. Check every character — sends cannot be reversed.
                        </span>
                        <span className={styles.balanceValue} style={{ wordBreak: "break-all", fontSize: 13 }}>{recipient}</span>
                    </div>
                )}

                {error && <div className={styles.errorBanner}>{error}</div>}

                <div className={styles.actions}>
                    <button onClick={onClose} className={`btn-ghost ${styles.cancelButton}`}>
                        Cancel
                    </button>
                    {isReviewing ? (
                        <button onClick={handleSend} disabled={!canSend} className={`btn-glow ${styles.primaryButton}`}>
                            {isSending ? "Sending..." : `Confirm send ${amount.trim()} USDC`}
                        </button>
                    ) : (
                        <button onClick={() => setIsReviewing(true)} disabled={!canSend} className={`btn-glow ${styles.primaryButton}`}>
                            Review
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SendModal;
