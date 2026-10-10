import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { maxUint256 } from "viem";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { createSigningClientFromMnemonic, COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import usdcUrl from "../../assets/lobby/usdc.svg";
import usdtUrl from "../../assets/lobby/usdt.svg";
import useDecimals from "../../hooks/wallet/useDecimals";
import useWalletBalance from "../../hooks/wallet/useWalletBalance";
import useAllowance from "../../hooks/wallet/useAllowance";
import useApprove from "../../hooks/wallet/useApprove";
import useDepositUSDC from "../../hooks/wallet/useDepositUSDC";
import { convertAmountToBigInt } from "../../utils/currency";
import { useToast } from "../../context/ToastContext";
import { useNetwork } from "../../context/NetworkContext";
import { getCosmosMnemonic, getCosmosAddress } from "../../utils/cosmos/storage";
import { base64ToHex } from "../../utils/encodingUtils";
import { withdrawAbi, BRIDGE_ADDRESS } from "../../abis/contractABI";
import { ETH_USDC_ADDRESS, ETH_USDT_ADDRESS } from "../../config/constants";
import styles from "./DepositWithdrawPanel.module.css";

export type WalletTab = "deposit" | "withdraw";

interface DepositWithdrawPanelProps {
    tab: WalletTab;
    cosmosAddress: string;
    usdcBalanceMicro: string;
    onBalanceRefresh: () => Promise<void> | void;
}

/* ── Deposit (port of DepositModal's flow, mock's deposit-card layout) ── */

type DepositToken = "USDC" | "USDT";

const TOKEN_ADDRESSES: Record<DepositToken, string> = {
    USDC: ETH_USDC_ADDRESS,
    USDT: ETH_USDT_ADDRESS
};

const TOKEN_ICONS: Record<DepositToken, string> = {
    USDC: usdcUrl,
    USDT: usdtUrl
};

const DepositCard: React.FC<{ cosmosAddress: string; onConfirmed: () => Promise<void> | void }> = ({ cosmosAddress, onConfirmed }) => {
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
    const { deposit, depositToken, isPending: isDepositSubmitting, isDepositPending, isDepositConfirmed, depositError, hash: depositHash } = useDepositUSDC();

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
            void onConfirmed();
        }
    }, [isDepositConfirmed, onConfirmed]);

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

    const handleMax = useCallback(() => {
        if (balance === undefined) return;
        setAmount((Number(balance) / 10 ** decimals).toString());
    }, [balance, decimals]);

    if (isDone) {
        return (
            <div className={`pane-lite ${styles.card}`}>
                <div className={styles.title}>Deposit</div>
                <div className={styles.alertSuccess}>
                    <p className={styles.alertTitle}>Deposit complete</p>
                    <p className={styles.alertText}>b52USDC has been deposited and will appear in your balance shortly.</p>
                    {depositHash && <p className={styles.monoHash}>Tx: {depositHash.slice(0, 18)}…</p>}
                </div>
                <button
                    className={`btn-glow shimmer-hover ${styles.primaryButton}`}
                    onClick={() => {
                        setIsDone(false);
                        setAmount("");
                    }}
                >
                    Make another deposit
                </button>
            </div>
        );
    }

    return (
        <div className={`pane-lite ${styles.card}`}>
            <div className={styles.title}>Deposit</div>

            <div className={styles.tokenRow}>
                {(Object.keys(TOKEN_ADDRESSES) as DepositToken[]).map(token => (
                    <button
                        key={token}
                        className={`${styles.tokenChip} ${selectedToken === token ? styles.tokenChipOn : ""}`}
                        aria-pressed={selectedToken === token}
                        onClick={() => setSelectedToken(token)}
                    >
                        <img src={TOKEN_ICONS[token]} alt="" className={styles.tokenIcon} />
                        <span>{token}</span>
                    </button>
                ))}
            </div>

            <div className={styles.field}>
                <span className="section-label">Amount ({selectedToken})</span>
                <div className={`search-field ${styles.amountField}`}>
                    <img src={TOKEN_ICONS[selectedToken]} alt="" className={styles.tokenIcon} />
                    <input
                        type="number"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.000001"
                        className={styles.amountInput}
                    />
                    <button className={styles.maxChip} onClick={handleMax}>
                        MAX
                    </button>
                </div>
                {isWeb3Connected && balance !== undefined && (
                    <div className={styles.balanceLine}>
                        Balance: {(Number(balance) / 10 ** decimals).toFixed(2)} {selectedToken}
                    </div>
                )}
                {isExceedingBalance && <p className={styles.fieldError}>Amount exceeds available balance</p>}
            </div>

            <div className={styles.warningNote}>
                Deposits are minted as b52USDC to your Block52 address after the Ethereum transaction confirms.
            </div>

            {error !== "" && <div className={styles.errorBanner}>{error}</div>}

            {!isWeb3Connected ? (
                <button className={`btn-glow shimmer-hover ${styles.primaryButton}`} onClick={() => openAppKit()}>
                    Connect Web3 Wallet
                </button>
            ) : isAllowed ? (
                <button
                    className={`btn-glow shimmer-hover ${styles.primaryButton}`}
                    onClick={handleDeposit}
                    disabled={amountBigInt <= 0n || isDepositing || isExceedingBalance}
                >
                    {isDepositing ? "Depositing…" : "Deposit"}
                </button>
            ) : (
                <button
                    className={`btn-glow shimmer-hover ${styles.primaryButton}`}
                    onClick={handleApprove}
                    disabled={amountBigInt <= 0n || isApproving || isExceedingBalance}
                >
                    {isApproving ? "Approving…" : "Approve"}
                </button>
            )}
        </div>
    );
};

/* ── Withdraw (inline step machine: initiate → validator sig → complete on Ethereum) ── */

const POLL_MS = 3000;
const SLOW_THRESHOLD = 20;

type Step = "input" | "initiating" | "waiting_sig" | "ready" | "completing" | "done";

interface WithdrawalInfo {
    nonce: string;
    baseAddress: string;
    amount: string;
    signature: string;
}

const WithdrawCard: React.FC<{ usdcBalanceMicro: string; onDone: () => Promise<void> | void }> = ({ usdcBalanceMicro, onDone }) => {
    const { showSuccess } = useToast();
    const { address: web3Address, isConnected: isWeb3Connected } = useAppKitAccount();
    const { open: openAppKit } = useAppKit();
    const { currentNetwork } = useNetwork();

    const { data: ethTxHash, writeContract, error: writeError } = useWriteContract();
    const { isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({ hash: ethTxHash });

    const [amount, setAmount] = useState("");
    const [step, setStep] = useState<Step>("input");
    const [error, setError] = useState("");
    const [cosmosTxHash, setCosmosTxHash] = useState("");
    const [withdrawalInfo, setWithdrawalInfo] = useState<WithdrawalInfo | null>(null);
    const [pollCount, setPollCount] = useState(0);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const balance = Number(usdcBalanceMicro) / 1_000_000;
    const numericAmount = parseFloat(amount) || 0;

    const clearPoll = () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    useEffect(() => () => clearPoll(), []);

    useEffect(() => {
        if (isTxConfirmed && step === "completing") {
            setStep("done");
            showSuccess("Withdrawal complete!");
            void onDone();
        }
    }, [isTxConfirmed, step, showSuccess, onDone]);

    useEffect(() => {
        if (writeError && step === "completing") {
            setError(writeError.message ?? "Ethereum transaction failed");
            setStep("ready");
        }
    }, [writeError, step]);

    const getSigningClient = useCallback(async () => {
        const mnemonic = getCosmosMnemonic();
        const fromAddress = getCosmosAddress();
        if (!mnemonic || !fromAddress) throw new Error("No wallet found. Create or import a wallet first.");

        const client = await createSigningClientFromMnemonic(
            {
                rpcEndpoint: currentNetwork.rpc,
                restEndpoint: currentNetwork.rest,
                chainId: COSMOS_CONSTANTS.CHAIN_ID,
                prefix: COSMOS_CONSTANTS.ADDRESS_PREFIX,
                denom: COSMOS_CONSTANTS.GAS_DENOM,
                gasPrice: COSMOS_CONSTANTS.DEFAULT_GAS_PRICE
            },
            mnemonic
        );
        return { client, fromAddress };
    }, [currentNetwork]);

    const startPolling = useCallback(
        (microAmount: string, targetAddress: string) => {
            clearPoll();

            const poll = async () => {
                try {
                    const { client, fromAddress } = await getSigningClient();
                    const withdrawals: any[] = await client.listWithdrawalRequests(fromAddress);

                    const match = withdrawals
                        .filter(w => w.base_address?.toLowerCase() === targetAddress.toLowerCase() && w.amount === microAmount)
                        .sort((a: any, b: any) => {
                            if (a.status === "signed" && b.status !== "signed") return -1;
                            if (b.status === "signed" && a.status !== "signed") return 1;
                            return (b.created_at ?? 0) - (a.created_at ?? 0);
                        })[0];

                    if (match?.status === "signed" && match.signature) {
                        clearPoll();
                        setWithdrawalInfo({
                            nonce: match.nonce,
                            baseAddress: match.base_address,
                            amount: match.amount,
                            signature: match.signature
                        });
                        setStep("ready");
                    } else {
                        setPollCount(n => n + 1);
                    }
                } catch (err) {
                    console.error("[WithdrawCard] poll error:", err);
                }
            };

            void poll();
            pollRef.current = setInterval(poll, POLL_MS);
        },
        [getSigningClient]
    );

    const reset = () => {
        clearPoll();
        setStep("input");
        setError("");
        setAmount("");
        setCosmosTxHash("");
        setWithdrawalInfo(null);
        setPollCount(0);
    };

    const handleInitiate = useCallback(async () => {
        if (!isWeb3Connected || !web3Address) {
            setError("Connect your Web3 wallet first");
            return;
        }
        if (numericAmount < 0.01) {
            setError("Minimum withdrawal is 0.01 USDC");
            return;
        }
        if (numericAmount > balance) {
            setError("Amount exceeds available balance");
            return;
        }

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
                withdrawalInfo.nonce as `0x${string}`,
                base64ToHex(withdrawalInfo.signature) as `0x${string}`
            ]
        });
    }, [withdrawalInfo, writeContract]);

    return (
        <div className={`pane-lite ${styles.card}`}>
            <div className={styles.title}>Withdraw</div>

            {error !== "" && <div className={styles.errorBanner}>{error}</div>}

            {step === "input" && (
                <>
                    <div className={styles.field}>
                        <span className="section-label">Amount</span>
                        <div className={`search-field ${styles.amountField}`}>
                            <img src={usdcUrl} alt="" className={styles.tokenIcon} />
                            <input
                                type="number"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                min="0.01"
                                step="0.01"
                                className={styles.amountInput}
                            />
                            <button className={styles.maxChip} onClick={() => setAmount(balance.toFixed(2))}>
                                MAX
                            </button>
                        </div>
                        <p className={styles.hint}>Minimum: 0.01 USDC</p>
                    </div>

                    <div className={styles.field}>
                        <span className="section-label">To address on Ethereum</span>
                        <div className={`search-field ${styles.addressField}`}>
                            {isWeb3Connected && web3Address ? (
                                <span className={styles.addressText}>
                                    {web3Address.slice(0, 6)}…{web3Address.slice(-4)} (connected wallet)
                                </span>
                            ) : (
                                <span className={styles.addressText}>Connect your Web3 wallet to receive the withdrawal</span>
                            )}
                        </div>
                    </div>

                    <div className={styles.feeRow}>
                        <span>Bridge fee</span>
                        <span className={styles.feeValue}>$0.00</span>
                    </div>

                    {isWeb3Connected && web3Address ? (
                        <button
                            className={`btn-glow shimmer-hover ${styles.primaryButton}`}
                            onClick={handleInitiate}
                            disabled={numericAmount <= 0}
                        >
                            Withdraw {numericAmount > 0 ? `$${numericAmount.toFixed(2)}` : ""}
                        </button>
                    ) : (
                        <button className={`btn-glow shimmer-hover ${styles.primaryButton}`} onClick={() => openAppKit()}>
                            Connect Web3 Wallet
                        </button>
                    )}
                </>
            )}

            {step === "initiating" && (
                <div className={styles.stepBox}>
                    <div className={styles.spinner} />
                    <p className={styles.stepTitle}>Initiating withdrawal</p>
                    <p className={styles.stepText}>Signing request on the Block52 chain…</p>
                </div>
            )}

            {step === "waiting_sig" && (
                <div className={styles.stepBox}>
                    <div className={styles.spinner} />
                    <p className={styles.stepTitle}>Waiting for validator signature</p>
                    <p className={styles.stepText}>Checking… ({pollCount} {pollCount === 1 ? "attempt" : "attempts"})</p>
                    {cosmosTxHash !== "" && <p className={styles.monoHash}>Cosmos tx: {cosmosTxHash.slice(0, 16)}…</p>}
                    {pollCount > SLOW_THRESHOLD && (
                        <p className={styles.hint}>Signing is taking longer than expected — it continues in the background.</p>
                    )}
                    <button className={`btn-ghost ${styles.copyPill}`} onClick={reset}>
                        Start over
                    </button>
                </div>
            )}

            {step === "ready" && withdrawalInfo && (
                <>
                    <div className={styles.alertSuccess}>
                        <p className={styles.alertTitle}>Validator signature received</p>
                        <p className={styles.alertText}>Ready to complete the withdrawal on Ethereum.</p>
                    </div>
                    <div className={styles.balanceRow}>
                        <span className={styles.balanceLabel}>Amount</span>
                        <span className={styles.balanceValue}>
                            ${(Number(withdrawalInfo.amount) / Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)).toFixed(2)} USDC
                        </span>
                    </div>
                    <div className={styles.balanceRow}>
                        <span className={styles.balanceLabel}>To</span>
                        <span className={styles.monoHash}>
                            {withdrawalInfo.baseAddress.slice(0, 10)}…{withdrawalInfo.baseAddress.slice(-8)}
                        </span>
                    </div>
                    <button className={`btn-glow shimmer-hover ${styles.primaryButton}`} onClick={handleCompleteOnEthereum}>
                        Complete on Ethereum
                    </button>
                </>
            )}

            {step === "completing" && (
                <div className={styles.stepBox}>
                    <div className={styles.spinner} />
                    <p className={styles.stepTitle}>Completing on Ethereum</p>
                    <p className={styles.stepText}>Confirm the transaction in your wallet…</p>
                </div>
            )}

            {step === "done" && (
                <>
                    <div className={styles.alertSuccess}>
                        <p className={styles.alertTitle}>Withdrawal complete</p>
                        <p className={styles.alertText}>USDC has been transferred to your Ethereum wallet.</p>
                        {ethTxHash && <p className={styles.monoHash}>Tx: {ethTxHash.slice(0, 18)}…</p>}
                    </div>
                    <button className={`btn-glow shimmer-hover ${styles.primaryButton}`} onClick={reset}>
                        Done
                    </button>
                </>
            )}
        </div>
    );
};

const DepositWithdrawPanel: React.FC<DepositWithdrawPanelProps> = ({ tab, cosmosAddress, usdcBalanceMicro, onBalanceRefresh }) => (
    <>
        {tab === "deposit" ? (
            <DepositCard cosmosAddress={cosmosAddress} onConfirmed={onBalanceRefresh} />
        ) : (
            <WithdrawCard usdcBalanceMicro={usdcBalanceMicro} onDone={onBalanceRefresh} />
        )}
    </>
);

export default DepositWithdrawPanel;
