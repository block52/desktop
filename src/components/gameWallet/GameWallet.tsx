import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useToast } from "../../context/ToastContext";
import styles from "./GameWallet.module.css";

interface GameWalletProps {
    cosmosAddress: string | null;
    usdcBalance: string;
    onDeposit: () => void;
    onWithdraw: () => void;
    onSend: () => void;
    onCreateWallet: () => void;
    onImportWallet: () => void;
    onRefresh?: () => Promise<void>;
}

const GameWallet: React.FC<GameWalletProps> = ({
    cosmosAddress,
    usdcBalance,
    onDeposit,
    onWithdraw,
    onSend,
    onCreateWallet,
    onImportWallet,
    onRefresh
}) => {
    const navigate = useNavigate();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { open: openAppKit } = useAppKit();
    const { address: web3Address, isConnected: isWeb3Connected } = useAppKitAccount();
    const { showToast } = useToast();

    const handleRefresh = useCallback(async () => {
        if (!onRefresh || isRefreshing) return;
        setIsRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setIsRefreshing(false);
        }
    }, [onRefresh, isRefreshing]);

    const copyAddress = useCallback(() => {
        if (!cosmosAddress) return;
        navigator.clipboard.writeText(cosmosAddress);
        showToast("Address copied", "success");
    }, [cosmosAddress, showToast]);

    const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    const Web3Section = (
        <div>
            <span className={styles.web3Label}>Web3 Wallet</span>
            {isWeb3Connected && web3Address ? (
                <div className={styles.web3Connected}>
                    <span className={styles.web3Address}>{truncate(web3Address)}</span>
                    <button
                        onClick={() => openAppKit({ view: "Account" })}
                        className={styles.disconnectButton}
                    >
                        Manage
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => openAppKit()}
                    className={`${styles.primaryButton} ${styles.fullWidth}`}
                >
                    Connect Wallet
                </button>
            )}
        </div>
    );

    if (!cosmosAddress) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <h2 className={styles.headerTitle}>Game Wallet</h2>
                </div>
                <div className={styles.body}>
                    <p className={styles.emptyText}>Create or import a wallet to start playing</p>
                    <div className={styles.setupButtons}>
                        <button
                            onClick={onCreateWallet}
                            className={`${styles.primaryButton} ${styles.fullWidth}`}
                        >
                            Create New Wallet
                        </button>
                        <button
                            onClick={onImportWallet}
                            className={`${styles.secondaryButton} ${styles.fullWidth}`}
                        >
                            Import Existing Wallet
                        </button>
                    </div>
                    <hr className={styles.divider} />
                    {Web3Section}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.headerTitle}>Game Wallet</h2>
                <div className={styles.headerActions}>
                    <button
                        onClick={handleRefresh}
                        disabled={!onRefresh || isRefreshing}
                        className={styles.iconButton}
                        title="Refresh balance"
                    >
                        <svg
                            className={isRefreshing ? styles.spinning : ""}
                            width="16" height="16"
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                    <button
                        onClick={() => navigate("/wallet")}
                        className={styles.iconButton}
                        title="Manage wallet"
                    >
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className={styles.body}>
                {/* Address */}
                <span className={styles.fieldLabel}>Address</span>
                <div className={styles.addressRow}>
                    <input
                        type="text"
                        value={cosmosAddress}
                        readOnly
                        className={styles.addressInput}
                    />
                    <button onClick={copyAddress} className={styles.primaryButton}>
                        Copy
                    </button>
                </div>

                {/* USDC Balance */}
                <div className={styles.balanceCard}>
                    <div className={styles.balanceLeft}>
                        <div className={styles.balanceIcon}>$</div>
                        <div>
                            <p className={styles.balanceName}>USDC Balance</p>
                            <p className={styles.balanceSub}>Gaming funds</p>
                        </div>
                    </div>
                    <span className={styles.balanceAmount}>
                        ${Number(usdcBalance).toFixed(2)}
                    </span>
                </div>

                {/* Actions */}
                <div className={styles.actionRow}>
                    <button onClick={onDeposit} className={`${styles.primaryButton} ${styles.flex1}`}>
                        Deposit
                    </button>
                    <button onClick={onWithdraw} className={`${styles.primaryButton} ${styles.flex1}`}>
                        Withdraw
                    </button>
                    <button onClick={onSend} className={`${styles.primaryButton} ${styles.flex1}`}>
                        Send
                    </button>
                </div>
                <hr className={styles.divider} />
                {Web3Section}
            </div>
        </div>
    );
};

export default GameWallet;
