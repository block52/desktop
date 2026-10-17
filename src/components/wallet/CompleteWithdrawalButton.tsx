import React from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { useNetwork } from "../../context/NetworkContext";
import { base64ToHex } from "../../utils/encodingUtils";
import { describeWithdrawError, fetchWithdrawalSignature } from "../../utils/withdrawalSignature";
import { withdrawAbi, BRIDGE_ADDRESS } from "../../abis/contractABI";
import { ETH_CHAIN_ID } from "../../config/constants";
import type { WithdrawalActivityItem } from "../../hooks/useWithdrawalActivity";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import EtherscanTxLink from "./EtherscanTxLink";
import styles from "./CompleteWithdrawalButton.module.css";

interface CompleteWithdrawalButtonProps {
    item: WithdrawalActivityItem;
    /** Base64 signature stored with the request, when there is one. Otherwise a validator is asked for it. */
    signature: string | null;
    onCompleted: () => void;
}

const Tick: React.FC = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <motion.path d="M5 12.5 10 17.5 19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
    </svg>
);

/** Finishes a validator-signed withdrawal on Ethereum from the Activity list, so it can be picked up after the wallet screen was left. */
const CompleteWithdrawalButton: React.FC<CompleteWithdrawalButtonProps> = ({ item, signature, onCompleted }) => {
    const { address: web3Address, isConnected } = useAppKitAccount();
    const { currentNetwork } = useNetwork();
    const [isSigning, setIsSigning] = React.useState(false);
    const [signError, setSignError] = React.useState("");
    const { data: txHash, writeContract, isPending, error, reset } = useWriteContract();
    const { data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

    const wrongWallet = !isConnected || web3Address === undefined || web3Address.toLowerCase() !== item.toAddress.toLowerCase();
    const confirmed = receipt?.status === "success";
    const reverted = receipt?.status === "reverted";

    React.useEffect(() => {
        if (confirmed) onCompleted();
    }, [confirmed, onCompleted]);

    if (txHash !== undefined && !reverted) {
        return (
            <MotionConfig reducedMotion="user">
                <div className={styles.box}>
                    <AnimatePresence mode="wait" initial={false}>
                        {confirmed ? (
                            <motion.span
                                key="done"
                                className={`${styles.status} ${styles.statusDone}`}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ type: "spring", stiffness: 380, damping: 20 }}
                            >
                                <Tick />
                                Withdrawal complete
                            </motion.span>
                        ) : (
                            <motion.div key="confirming" className={styles.box} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -4 }}>
                                <span className={styles.status} role="status">
                                    <span className={styles.spinner} aria-hidden="true" />
                                    Confirming on Ethereum…
                                </span>
                                <span className={styles.note}>Usually under a minute. You can leave this page.</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <EtherscanTxLink hash={txHash} />
                </div>
            </MotionConfig>
        );
    }

    if (wrongWallet) {
        return (
            <span className={styles.note}>
                Connect {item.toAddress.slice(0, 6)}…{item.toAddress.slice(-4)} to complete this withdrawal.
            </span>
        );
    }

    const complete = async () => {
        reset();
        setSignError("");
        setIsSigning(true);
        try {
            const hex =
                signature !== null
                    ? base64ToHex(signature)
                    : await fetchWithdrawalSignature(currentNetwork.rest, { nonce: item.nonce, baseAddress: item.toAddress, amount: item.amountMicro });
            writeContract({
                address: BRIDGE_ADDRESS as `0x${string}`,
                abi: withdrawAbi,
                functionName: "withdraw",
                args: [BigInt(item.amountMicro), item.toAddress as `0x${string}`, item.nonce as `0x${string}`, hex as `0x${string}`],
                chainId: ETH_CHAIN_ID
            });
        } catch (err) {
            setSignError(err instanceof Error ? "A validator has not signed this withdrawal yet. Try again in a minute." : "Could not get a validator signature.");
        } finally {
            setIsSigning(false);
        }
    };

    const busyLabel = isSigning ? "Getting signature…" : isPending ? "Confirm in your wallet…" : null;

    return (
        <div className={styles.box}>
            <button type="button" className={`btn-glow ${styles.button}`} onClick={() => void complete()} disabled={busyLabel !== null}>
                <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                        key={busyLabel ?? "idle"}
                        className={styles.label}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                    >
                        {busyLabel !== null && <span className={styles.spinner} aria-hidden="true" />}
                        {busyLabel ?? "Complete on Ethereum"}
                    </motion.span>
                </AnimatePresence>
            </button>
            {isPending && <span className={styles.note}>Open your wallet app and approve the request.</span>}
            {reverted && <span className={styles.error}>The Ethereum transaction was reverted. Try again.</span>}
            {signError !== "" && <span className={styles.error}>{signError}</span>}
            {error && <span className={styles.error}>{describeWithdrawError(error.message)}</span>}
        </div>
    );
};

export default CompleteWithdrawalButton;
