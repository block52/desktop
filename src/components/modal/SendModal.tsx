import React, { useState, useCallback, useMemo } from "react";
import styles from "./SendModal.module.css";

const B52_ADDRESS_REGEX = /^b521[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38,}$/;

interface SendModalProps {
    fromAddress: string;
    usdcBalance: string;
    onSend: (recipient: string, amountUsdc: number) => Promise<string>;
    onClose: () => void;
}

const SendModal: React.FC<SendModalProps> = ({ fromAddress, usdcBalance, onSend, onClose }) => {
    const [recipient, setRecipient] = useState("");
    const [amount, setAmount] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState("");
    const [txHash, setTxHash] = useState("");

    const numericBalance = useMemo(() => Number(usdcBalance), [usdcBalance]);
    const numericAmount = useMemo(() => parseFloat(amount) || 0, [amount]);

    const isValidRecipient = useMemo(() => B52_ADDRESS_REGEX.test(recipient), [recipient]);
    const isExceedingBalance = numericAmount > numericBalance;
    const canSend = isValidRecipient && numericAmount > 0 && !isExceedingBalance && !isSending;

    const handleSend = useCallback(async () => {
        setError("");
        setIsSending(true);
        try {
            const hash = await onSend(recipient, numericAmount);
            setTxHash(hash);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Transaction failed");
        } finally {
            setIsSending(false);
        }
    }, [onSend, recipient, numericAmount]);

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
                        onChange={e => setRecipient(e.target.value.trim())}
                        placeholder="b521..."
                        className={`${styles.input} ${recipient && !isValidRecipient ? styles.inputError : ""}`}
                        spellCheck={false}
                    />
                    {recipient && !isValidRecipient && (
                        <p className={`${styles.inputHint} ${styles.inputHintError}`}>
                            Must be a valid b52 address (starts with b521)
                        </p>
                    )}
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Amount (USDC)</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
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

                {error && <div className={styles.errorBanner}>{error}</div>}

                <div className={styles.actions}>
                    <button onClick={onClose} className={`btn-ghost ${styles.cancelButton}`}>
                        Cancel
                    </button>
                    <button onClick={handleSend} disabled={!canSend} className={`btn-glow ${styles.primaryButton}`}>
                        {isSending ? "Sending..." : "Send"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SendModal;
