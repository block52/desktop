import React, { useState, useCallback, useEffect, useMemo } from "react";
import { maxUint256 } from "viem";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import useDecimals from "../../hooks/wallet/useDecimals";
import useWalletBalance from "../../hooks/wallet/useWalletBalance";
import useAllowance from "../../hooks/wallet/useAllowance";
import useApprove from "../../hooks/wallet/useApprove";
import useDepositUSDC from "../../hooks/wallet/useDepositUSDC";
import { convertAmountToBigInt } from "../../utils/currency";
import { BRIDGE_ADDRESS } from "../../abis/contractABI";
import { ETH_USDC_ADDRESS, ETH_USDT_ADDRESS } from "../../config/constants";
import styles from "./DepositModal.module.css";

type DepositToken = "USDC" | "USDT";

const TOKEN_ADDRESSES: Record<DepositToken, string> = {
    USDC: ETH_USDC_ADDRESS,
    USDT: ETH_USDT_ADDRESS,
};

interface DepositModalProps {
    cosmosAddress: string;
    onClose: () => void;
    onDepositConfirmed: () => Promise<void> | void;
}

const DepositModal: React.FC<DepositModalProps> = ({ cosmosAddress, onClose, onDepositConfirmed }) => {
    const { open: openAppKit } = useAppKit();
    const { isConnected: isWeb3Connected } = useAppKitAccount();

    const [selectedToken, setSelectedToken] = useState<DepositToken>("USDC");
    const tokenAddress = TOKEN_ADDRESSES[selectedToken];

    const [amount, setAmount] = useState("");
    const [approvedAmount, setApprovedAmount] = useState<bigint>(0n);
    const [error, setError] = useState("");
    const [isDone, setIsDone] = useState(false);

    const { decimals } = useDecimals(tokenAddress);
    const { balance } = useWalletBalance(tokenAddress);
    const { allowance } = useAllowance(tokenAddress);
    const { approve, isLoading: isApproveSubmitting, isApprovePending, isApproveConfirmed, approveError } = useApprove();
    const { deposit, depositToken, isPending: isDepositSubmitting, isDepositPending, isDepositConfirmed, depositError } = useDepositUSDC();

    useEffect(() => {
        if (allowance !== undefined) setApprovedAmount(allowance);
    }, [allowance]);

    useEffect(() => {
        setApprovedAmount(0n);
        setAmount("");
        setError("");
    }, [selectedToken]);

    useEffect(() => {
        if (isApproveConfirmed) setApprovedAmount(maxUint256);
    }, [isApproveConfirmed]);

    useEffect(() => {
        if (isDepositConfirmed) {
            setIsDone(true);
            void onDepositConfirmed();
        }
    }, [isDepositConfirmed, onDepositConfirmed]);

    useEffect(() => {
        if (approveError) setError(approveError.message);
    }, [approveError]);

    useEffect(() => {
        if (depositError) setError(depositError.message);
    }, [depositError]);

    const amountBigInt = useMemo(() => convertAmountToBigInt(amount, decimals), [amount, decimals]);
    const isExceedingBalance = balance !== undefined && amountBigInt > balance;
    const isAllowed = amountBigInt > 0n && approvedAmount >= amountBigInt && !isExceedingBalance;
    const isApproving = isApproveSubmitting || isApprovePending;
    const isDepositing = isDepositSubmitting || isDepositPending;

    const handleApprove = useCallback(async () => {
        setError("");
        try {
            await approve(tokenAddress, BRIDGE_ADDRESS, maxUint256);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Approval failed");
        }
    }, [approve, tokenAddress]);

    const handleDeposit = useCallback(async () => {
        setError("");
        try {
            if (selectedToken === "USDC") {
                await deposit(amountBigInt, cosmosAddress);
            } else {
                await depositToken(amountBigInt, cosmosAddress, tokenAddress);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Deposit failed");
        }
    }, [selectedToken, deposit, depositToken, amountBigInt, cosmosAddress, tokenAddress]);

    const handleOverlayClick = useCallback(
        (e: React.MouseEvent) => {
            if (e.target === e.currentTarget) onClose();
        },
        [onClose]
    );

    if (isDone) {
        return (
            <div className={styles.overlay} onClick={handleOverlayClick}>
                <div className={styles.modal}>
                    <div className={styles.header}>
                        <h2 className={styles.title}>Deposit Complete</h2>
                        <button onClick={onClose} className={styles.closeButton}>
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <p className={styles.doneText}>
                        {selectedToken} has been deposited and will appear in your Block52 wallet shortly.
                    </p>
                    <button onClick={onClose} className={styles.primaryButton} style={{ width: "100%" }}>
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
                    <h2 className={styles.title}>Deposit</h2>
                    <button onClick={onClose} className={styles.closeButton}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {!isWeb3Connected ? (
                    <>
                        <p className={styles.hint}>Connect a Web3 wallet to deposit funds.</p>
                        <button onClick={() => openAppKit()} className={styles.primaryButton} style={{ width: "100%" }}>
                            Connect Web3 Wallet
                        </button>
                    </>
                ) : (
                    <>
                        <div className={styles.tokenRow}>
                            <button
                                onClick={() => setSelectedToken("USDC")}
                                className={selectedToken === "USDC" ? styles.tokenButtonSelected : styles.tokenButton}
                            >
                                USDC
                            </button>
                            <button
                                onClick={() => setSelectedToken("USDT")}
                                className={selectedToken === "USDT" ? styles.tokenButtonSelected : styles.tokenButton}
                            >
                                USDT
                            </button>
                        </div>

                        <div className={styles.balanceBox}>
                            <span className={styles.balanceLabel}>Web3 wallet balance</span>
                            <span className={styles.balanceValue}>
                                {balance !== undefined ? (Number(balance) / 10 ** decimals).toFixed(2) : "0.00"} {selectedToken}
                            </span>
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Amount ({selectedToken})</label>
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

                        <div className={styles.addressBox}>
                            <span className={styles.hint} style={{ marginBottom: 0 }}>
                                b52{selectedToken} will be minted to your Block52 address:
                            </span>
                            <span className={styles.addressText}>{cosmosAddress}</span>
                        </div>

                        {error && <div className={styles.errorBanner}>{error}</div>}

                        <div className={styles.actions}>
                            <button onClick={onClose} className={styles.cancelButton}>
                                Cancel
                            </button>
                            {isAllowed ? (
                                <button onClick={handleDeposit} disabled={amountBigInt === 0n || isDepositing || isExceedingBalance} className={styles.primaryButton}>
                                    {isDepositing ? "Depositing..." : "Deposit"}
                                </button>
                            ) : (
                                <button onClick={handleApprove} disabled={amountBigInt === 0n || isApproving || isExceedingBalance} className={styles.primaryButton}>
                                    {isApproving ? "Approving..." : "Approve"}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default DepositModal;
