import React, { useState, useEffect, useCallback, useRef } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useAppKitAccount, useAppKit } from "@reown/appkit/react";
import { createSigningClientFromMnemonic, COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import { getCosmosMnemonic, getCosmosAddress } from "../../utils/cosmos/storage";
import { base64ToHex } from "../../utils/encodingUtils";
import { withdrawAbi, BRIDGE_ADDRESS } from "../../abis/contractABI";
import { useToast } from "../../context/ToastContext";
import styles from "./WithdrawModal.module.css";

const RPC_ENDPOINT  = import.meta.env.VITE_RPC_ENDPOINT  ?? "http://localhost:26657";
const REST_ENDPOINT = import.meta.env.VITE_REST_ENDPOINT ?? "http://localhost:1317";
const POLL_MS       = 3000;
const SLOW_THRESHOLD = 20;

type Step = "input" | "initiating" | "waiting_sig" | "ready" | "completing" | "done";

interface WithdrawalInfo {
    nonce: string;
    baseAddress: string;
    amount: string;
    signature: string;
}

interface Props {
    usdcBalance: string;
    onClose: () => void;
}

const WithdrawModal: React.FC<Props> = ({ usdcBalance, onClose }) => {
    const { showSuccess, showError } = useToast();
    const { address: web3Address, isConnected: isWeb3Connected } = useAppKitAccount();
    const { open: openAppKit } = useAppKit();

    const { data: ethTxHash, writeContract, error: writeError } = useWriteContract();
    const { isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({ hash: ethTxHash });

    const [amount, setAmount]             = useState("");
    const [step, setStep]                 = useState<Step>("input");
    const [error, setError]               = useState("");
    const [cosmosTxHash, setCosmosTxHash] = useState("");
    const [withdrawalInfo, setWithdrawalInfo] = useState<WithdrawalInfo | null>(null);
    const [pollCount, setPollCount]       = useState(0);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const balance = parseFloat(usdcBalance) || 0;
    const numericAmount = parseFloat(amount) || 0;

    const clearPoll = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };

    useEffect(() => () => clearPoll(), []);

    // Ethereum tx confirmed
    useEffect(() => {
        if (isTxConfirmed && step === "completing") {
            setStep("done");
            showSuccess("Withdrawal complete!");
        }
    }, [isTxConfirmed, step, showSuccess]);

    // Ethereum tx error
    useEffect(() => {
        if (writeError && step === "completing") {
            setError(writeError.message ?? "Ethereum transaction failed");
            setStep("ready");
        }
    }, [writeError, step]);

    const getSigningClient = useCallback(async () => {
        const mnemonic    = getCosmosMnemonic();
        const fromAddress = getCosmosAddress();
        if (!mnemonic || !fromAddress) throw new Error("No wallet found. Create or import a wallet first.");

        const client = await createSigningClientFromMnemonic(
            { rpcEndpoint: RPC_ENDPOINT, restEndpoint: REST_ENDPOINT,
              chainId: COSMOS_CONSTANTS.CHAIN_ID, prefix: COSMOS_CONSTANTS.ADDRESS_PREFIX,
              denom: COSMOS_CONSTANTS.GAS_DENOM, gasPrice: COSMOS_CONSTANTS.DEFAULT_GAS_PRICE },
            mnemonic
        );
        return { client, fromAddress };
    }, []);

    const startPolling = useCallback((microAmount: string, targetAddress: string) => {
        clearPoll();

        const poll = async () => {
            try {
                const { client, fromAddress } = await getSigningClient();
                const withdrawals: any[] = await client.listWithdrawalRequests(fromAddress);

                const match = withdrawals
                    .filter(w => w.base_address?.toLowerCase() === targetAddress.toLowerCase() && w.amount === microAmount)
                    .sort((a: any, b: any) => {
                        if (a.status === "signed" && b.status !== "signed") return -1;
                        if (b.status === "signed" && a.status !== "signed") return  1;
                        return (b.created_at ?? 0) - (a.created_at ?? 0);
                    })[0];

                if (match?.status === "signed" && match.signature) {
                    clearPoll();
                    setWithdrawalInfo({ nonce: match.nonce, baseAddress: match.base_address, amount: match.amount, signature: match.signature });
                    setStep("ready");
                } else {
                    setPollCount(n => n + 1);
                }
            } catch (err) {
                console.error("[WithdrawModal] poll error:", err);
            }
        };

        poll();
        pollRef.current = setInterval(poll, POLL_MS);
    }, [getSigningClient]);

    const handleInitiate = useCallback(async () => {
        if (!isWeb3Connected || !web3Address) { setError("Connect your Web3 wallet first"); return; }
        if (numericAmount < 0.01)             { setError("Minimum withdrawal is 0.01 USDC"); return; }
        if (numericAmount > balance)           { setError("Amount exceeds available balance"); return; }

        setStep("initiating");
        setError("");

        try {
            const { client } = await getSigningClient();
            const microAmount = BigInt(Math.floor(numericAmount * Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)));
            const hash = await client.initiateWithdrawal(web3Address, microAmount);
            setCosmosTxHash(hash);
            setStep("waiting_sig");
            startPolling(microAmount.toString(), web3Address);
        } catch (err: any) {
            setError(err.message ?? "Failed to initiate withdrawal");
            setStep("input");
        }
    }, [isWeb3Connected, web3Address, numericAmount, balance, getSigningClient, startPolling]);

    const handleCompleteOnEthereum = useCallback(() => {
        if (!withdrawalInfo) return;
        setStep("completing");
        setError("");

        writeContract({
            address: BRIDGE_ADDRESS as `0x${string}`,
            abi: withdrawAbi,
            functionName: "withdraw",
            args: [
                BigInt(withdrawalInfo.amount),
                withdrawalInfo.baseAddress as `0x${string}`,
                withdrawalInfo.nonce      as `0x${string}`,
                base64ToHex(withdrawalInfo.signature) as `0x${string}`
            ]
        });
    }, [withdrawalInfo, writeContract]);

    const handleOverlayClick = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); };

    const step1Active = ["input", "initiating", "waiting_sig"].includes(step);
    const step1Done   = ["ready", "completing", "done"].includes(step);
    const step2Active = step === "ready" || step === "completing";
    const step2Done   = step === "done";

    return (
        <div className={styles.overlay} onClick={handleOverlayClick}>
            <div className={styles.modal}>
                {/* Header */}
                <div className={styles.header}>
                    <h2 className={styles.title}>Withdraw Funds</h2>
                    <button onClick={onClose} className={styles.closeButton}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Step indicator */}
                <div className={styles.steps}>
                    <div className={`${styles.stepCircle} ${step1Done ? styles.stepDone : step1Active ? styles.stepActive : styles.stepInactive}`}>
                        {step1Done ? "✓" : "1"}
                    </div>
                    <div className={`${styles.stepLine} ${step1Done ? styles.stepLineDone : ""}`} />
                    <div className={`${styles.stepCircle} ${step2Done ? styles.stepDone : step2Active ? styles.stepActive : styles.stepInactive}`}>
                        {step2Done ? "✓" : "2"}
                    </div>
                </div>
                <div className={styles.stepLabels}>
                    <span className={styles.stepLabel}>Block52 Chain</span>
                    <span className={styles.stepLabel}>Ethereum</span>
                </div>

                {/* Error */}
                {error && <div className={styles.errorBanner}>{error}</div>}

                {/* ── Step: input ────────────────────────────────────── */}
                {step === "input" && (
                    <>
                        <div className={styles.balanceCard}>
                            <span className={styles.cardLabel}>Available balance</span>
                            <span className={styles.cardValue}>${balance.toFixed(2)} USDC</span>
                        </div>

                        {isWeb3Connected && web3Address ? (
                            <div className={styles.field}>
                                <label className={styles.label}>Withdrawal address (your Web3 wallet)</label>
                                <div className={styles.addressBox}>{web3Address}</div>
                                <p className={styles.hint}>Funds will be sent to your connected wallet</p>
                            </div>
                        ) : (
                            <div className={styles.field}>
                                <p className={styles.hint} style={{ marginBottom: 10 }}>
                                    Connect your Web3 wallet to receive the withdrawal.
                                </p>
                                <button onClick={() => openAppKit()} className={styles.primaryButton}>
                                    Connect Web3 Wallet
                                </button>
                            </div>
                        )}

                        {isWeb3Connected && web3Address && (
                            <div className={styles.field}>
                                <label className={styles.label}>Amount (USDC)</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    min="0.01"
                                    step="0.01"
                                    max={balance}
                                    className={styles.input}
                                />
                                <p className={styles.hint}>Minimum: 0.01 USDC</p>
                            </div>
                        )}

                        <div className={styles.actions}>
                            <button
                                onClick={handleInitiate}
                                disabled={!isWeb3Connected || !web3Address || numericAmount <= 0}
                                className={styles.primaryButton}
                            >
                                Withdraw
                            </button>
                            <button onClick={onClose} className={styles.cancelButton}>Cancel</button>
                        </div>
                    </>
                )}

                {/* ── Step: initiating ───────────────────────────────── */}
                {step === "initiating" && (
                    <div className={styles.spinnerWrap}>
                        <div className={`${styles.spinner} ${styles.spinnerBlue}`} />
                        <p className={styles.spinnerTitle}>Initiating Withdrawal</p>
                        <p className={styles.spinnerText}>Signing request on Block52 chain…</p>
                    </div>
                )}

                {/* ── Step: waiting_sig ──────────────────────────────── */}
                {step === "waiting_sig" && (
                    <div className={styles.spinnerWrap}>
                        <div className={`${styles.spinner} ${styles.spinnerYellow}`} />
                        <p className={styles.spinnerTitle}>Waiting for Validator Signature</p>
                        <p className={styles.spinnerText}>The validator is signing your withdrawal payload…</p>
                        {cosmosTxHash && <p className={styles.spinnerMono}>Cosmos tx: {cosmosTxHash.slice(0, 16)}…</p>}
                        <p className={styles.spinnerCount}>Checking… ({pollCount} {pollCount === 1 ? "attempt" : "attempts"})</p>
                        {pollCount > SLOW_THRESHOLD && (
                            <div className={styles.alertWarning}>
                                <p className={styles.alertWarningText}>
                                    Signing is taking longer than expected. You can close this dialog — the withdrawal will continue in the background.
                                </p>
                            </div>
                        )}
                        <button onClick={onClose} className={styles.closeLink}>
                            Close (withdrawal continues in background)
                        </button>
                    </div>
                )}

                {/* ── Step: ready ────────────────────────────────────── */}
                {step === "ready" && withdrawalInfo && (
                    <>
                        <div className={styles.alertSuccess}>
                            <p className={styles.alertSuccessTitle}>Validator Signature Received</p>
                            <p className={styles.alertSuccessText}>Ready to complete the withdrawal on Ethereum.</p>
                        </div>

                        <div className={styles.infoCard}>
                            <div className={styles.infoRow}>
                                <span className={styles.infoRowLabel}>Amount</span>
                                <span className={styles.infoRowValueBold}>
                                    ${(Number(withdrawalInfo.amount) / Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)).toFixed(2)} USDC
                                </span>
                            </div>
                            <div className={styles.infoRow}>
                                <span className={styles.infoRowLabel}>To</span>
                                <span className={styles.infoRowValue}>
                                    {withdrawalInfo.baseAddress.slice(0, 10)}…{withdrawalInfo.baseAddress.slice(-8)}
                                </span>
                            </div>
                        </div>

                        <div className={styles.actions}>
                            <button onClick={handleCompleteOnEthereum} className={styles.primaryButton}>
                                Complete on Ethereum
                            </button>
                            <p className={styles.noteText}>You can also complete this later from the Withdrawal Dashboard</p>
                            <button onClick={onClose} className={styles.cancelButton}>Close</button>
                        </div>
                    </>
                )}

                {/* ── Step: completing ───────────────────────────────── */}
                {step === "completing" && (
                    <div className={styles.spinnerWrap}>
                        <div className={`${styles.spinner} ${styles.spinnerGreen}`} />
                        <p className={styles.spinnerTitle}>Completing on Ethereum</p>
                        <p className={styles.spinnerText}>Confirm the transaction in your wallet…</p>
                    </div>
                )}

                {/* ── Step: done ─────────────────────────────────────── */}
                {step === "done" && (
                    <>
                        <div className={styles.alertSuccess}>
                            <p className={styles.alertSuccessTitle}>Withdrawal Complete!</p>
                            <p className={styles.alertSuccessText}>USDC has been transferred to your Ethereum wallet.</p>
                            {ethTxHash && <p style={{ color: "#6b7280", fontFamily: "monospace", fontSize: 11, marginTop: 6 }}>
                                Tx: {ethTxHash.slice(0, 18)}…
                            </p>}
                        </div>
                        <button onClick={onClose} className={styles.primaryButton}>Done</button>
                    </>
                )}
            </div>
        </div>
    );
};

export default WithdrawModal;
