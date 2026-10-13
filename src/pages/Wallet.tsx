import React, { useState, useCallback, useEffect } from "react";
import {
    generateWallet,
    createWalletFromMnemonic,
    getAddressFromMnemonic,
    isValidMnemonic,
    createSigningClientFromMnemonic,
    COSMOS_CONSTANTS,
} from "@block52/poker-vm-sdk";
import {
    getCosmosMnemonic,
    getCosmosAddress,
    setCosmosMnemonic,
    setCosmosAddress,
} from "../utils/cosmos/storage";
import { clearCosmosClient, clearSigningClientCache } from "../utils/cosmos/client";
import { useCosmosWallet } from "../hooks/useCosmosWallet";
import { microToDecimal, parseUsdcToMicro } from "../utils/currency";
import { useNetwork } from "../context/NetworkContext";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { useWithdrawalActivity } from "../hooks/useWithdrawalActivity";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import AvailableCard from "../components/wallet/AvailableCard";
import ActivityPanel from "../components/wallet/ActivityPanel";
import DepositWithdrawPanel, { WalletTab } from "../components/wallet/DepositWithdrawPanel";
import WalletKeysModal from "../components/wallet/WalletKeysModal";
import SeedPhraseGrid from "../components/wallet/SeedPhraseGrid";
import SendModal from "../components/modal/SendModal";
import AvatarPickerModal from "../components/modal/AvatarPickerModal";
import { useOnChainAvatar } from "../hooks/useOnChainAvatar";
import styles from "./Wallet.module.css";

const Wallet: React.FC = () => {
    const { address: cosmosAddress, balance, refreshBalance } = useCosmosWallet();
    const { currentNetwork } = useNetwork();

    const [showSendModal, setShowSendModal] = useState(false);
    const [showKeysModal, setShowKeysModal] = useState(false);
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    const [avatarRefresh, setAvatarRefresh] = useState(0);
    const [walletTab, setWalletTab] = useState<WalletTab>("deposit");
    const [refreshToken, setRefreshToken] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        setRefreshToken(t => t + 1);
        try {
            await refreshBalance();
        } finally {
            setIsRefreshing(false);
        }
    }, [refreshBalance]);

    const usdcBalanceAmount =
        balance.find(b => b.denom === COSMOS_CONSTANTS.TOKEN_DENOM)?.amount ?? "0";

    const handleSend = useCallback(
        async (recipient: string, amountUsdc: string): Promise<string> => {
            const mnemonic = getCosmosMnemonic();
            const fromAddress = getCosmosAddress();

            if (!mnemonic || !fromAddress) {
                throw new Error("No wallet found. Please create or import a wallet first.");
            }

            const signingClient = await createSigningClientFromMnemonic(
                {
                    rpcEndpoint: currentNetwork.rpc,
                    restEndpoint: currentNetwork.rest,
                    chainId: COSMOS_CONSTANTS.CHAIN_ID,
                    prefix: COSMOS_CONSTANTS.ADDRESS_PREFIX,
                    denom: COSMOS_CONSTANTS.GAS_DENOM,
                    gasPrice: COSMOS_CONSTANTS.DEFAULT_GAS_PRICE,
                },
                mnemonic,
            );

            const amountMicro = parseUsdcToMicro(amountUsdc);
            return signingClient.sendTokens(
                fromAddress,
                recipient,
                amountMicro,
                COSMOS_CONSTANTS.TOKEN_DENOM,
            );
        },
        [currentNetwork],
    );

    const [existingAddress, setExistingAddress] = useState<string | null>(null);

    const { open: openAppKit } = useAppKit();
    const { address: web3Address, isConnected: isWeb3Connected } = useAppKitAccount();
    const { items: activityItems } = useWithdrawalActivity(existingAddress, undefined, refreshToken);
    const onChainAvatar = useOnChainAvatar(existingAddress, avatarRefresh);

    const pendingWithdrawalMicro = activityItems
        .filter(i => i.status === "pending")
        .reduce((sum, i) => sum + BigInt(i.amountMicro), 0n)
        .toString();

    const [newMnemonic, setNewMnemonic] = useState("");
    const [newAddress, setNewAddress] = useState("");

    const [importMnemonic, setImportMnemonic] = useState("");

    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const mnemonic = getCosmosMnemonic();
            let address = getCosmosAddress();

            // The key is the source of truth: always derive the address from it, and repair the stored copy if it differs.
            if (mnemonic) {
                try {
                    const derived = await getAddressFromMnemonic(mnemonic, "b52");
                    if (derived !== address) setCosmosAddress(derived);
                    address = derived;
                } catch (err) {
                    console.error("Failed to derive address:", err);
                }
            }

            setExistingAddress(address);
            setIsLoading(false);
        };

        load();
    }, []);

    const handleSeedSaved = () => {
        setExistingAddress(newAddress);
        setNewMnemonic("");
        setNewAddress("");
    };

    const handleGenerate = async () => {
        setIsBusy(true);
        setError("");
        try {
            const wallet = await generateWallet("b52", 24);
            await setCosmosMnemonic(wallet.mnemonic);
            setCosmosAddress(wallet.address);
            clearSigningClientCache();
            clearCosmosClient();
            setNewMnemonic(wallet.mnemonic);
            setNewAddress(wallet.address);
        } catch (err) {
            console.error("Generate wallet failed:", err);
            setError("Failed to generate wallet. Please try again.");
        } finally {
            setIsBusy(false);
        }
    };

    const handleImport = async () => {
        setIsBusy(true);
        setError("");
        try {
            if (!isValidMnemonic(importMnemonic.trim())) {
                setError("Invalid seed phrase. Must be 12, 15, 18, 21, or 24 words.");
                return;
            }
            const wallet = await createWalletFromMnemonic(importMnemonic.trim(), "b52");
            await setCosmosMnemonic(importMnemonic.trim());
            setCosmosAddress(wallet.address);
            clearSigningClientCache();
            clearCosmosClient();
            setExistingAddress(wallet.address);
            setImportMnemonic("");
        } catch (err) {
            console.error("Import wallet failed:", err);
            setError("Failed to import wallet. Check your seed phrase.");
        } finally {
            setIsBusy(false);
        }
    };

    const copy = useCopyToClipboard();

    if (isLoading) {
        return <div className={styles.loading}>Loading wallet...</div>;
    }

    return (
        <div className={styles.page}>
            <div className={styles.inner}>
                <div className={styles.header}>
                    <h1 className={styles.pageTitle}>Wallet</h1>
                    <p className={styles.pageSubtitle}>Your on-chain USDC balance. Deposit from your Web3 wallet, withdraw any time.</p>
                </div>

                {existingAddress && (
                    <div className={styles.grid}>
                        <AvailableCard
                            usdcBalanceMicro={usdcBalanceAmount}
                            pendingWithdrawalMicro={pendingWithdrawalMicro}
                            address={existingAddress}
                            web3Address={web3Address === undefined ? null : web3Address}
                            isWeb3Connected={isWeb3Connected}
                            tab={walletTab}
                            onTabChange={setWalletTab}
                            onSend={() => setShowSendModal(true)}
                            onManageWeb3={() => openAppKit({ view: "Account" })}
                            onShowKeys={() => setShowKeysModal(true)}
                            onRefresh={handleRefresh}
                            isRefreshing={isRefreshing}
                        />
                        <DepositWithdrawPanel
                            tab={walletTab}
                            cosmosAddress={existingAddress}
                            usdcBalanceMicro={usdcBalanceAmount}
                            onBalanceRefresh={refreshBalance}
                        />
                    </div>
                )}

                {existingAddress && (
                    <div className={`pane-lite ${styles.card}`}>
                        <span className="section-label">Table avatar</span>
                        <p className={styles.cardDesc}>
                            {onChainAvatar === null
                                ? "Show one of your NFTs on your seat at the tables."
                                : `Registered: ${onChainAvatar.contractAddress.slice(0, 8)}…${onChainAvatar.contractAddress.slice(-4)} #${onChainAvatar.tokenId}`}
                        </p>
                        <button type="button" className={`btn-ghost ${styles.ghostAction}`} onClick={() => setShowAvatarPicker(true)}>
                            {onChainAvatar === null ? "Choose NFT avatar" : "Change NFT avatar"}
                        </button>
                    </div>
                )}

                {showAvatarPicker && existingAddress && (
                    <AvatarPickerModal
                        cosmosAddress={existingAddress}
                        current={onChainAvatar}
                        onClose={() => setShowAvatarPicker(false)}
                        onRegistered={() => setAvatarRefresh(count => count + 1)}
                    />
                )}

                {existingAddress && (
                    <>
                        <h2 className={styles.sectionTitle}>Activity</h2>
                        <ActivityPanel address={existingAddress} refreshToken={refreshToken} />
                    </>
                )}

                {/* Generate new wallet */}
                {!existingAddress && (
                    <div className={`pane-lite ${styles.card}`}>
                        <span className="section-label">Generate New Wallet</span>
                        <p className={styles.cardDesc}>
                            Create a new Block52 wallet with a 24-word seed phrase.
                        </p>

                        <button
                            onClick={handleGenerate}
                            disabled={isBusy}
                            className={`btn-glow ${styles.primaryAction} ${styles.fullWidth}`}
                        >
                            {isBusy ? "Generating..." : "Generate New Wallet"}
                        </button>

                        {newMnemonic && (
                            <>
                                <div className={styles.warning}>
                                    <p className={styles.warningTitle}>Important</p>
                                    <p className={styles.warningText}>
                                        Write down your seed phrase and store it safely. This is the only way to recover your wallet.
                                    </p>
                                </div>

                                <div className={styles.field}>
                                    <div className={styles.seedHeaderRow}>
                                        <span className={styles.fieldLabel}>Your Seed Phrase</span>
                                        <button
                                            onClick={() => copy(newMnemonic)}
                                            className={`btn-ghost ${styles.ghostAction}`}
                                        >
                                            Copy
                                        </button>
                                    </div>
                                    <SeedPhraseGrid mnemonic={newMnemonic} />
                                </div>

                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Your Address</span>
                                    <div className={styles.fieldRow}>
                                        <input
                                            type="text"
                                            value={newAddress}
                                            readOnly
                                            className={styles.input}
                                        />
                                        <button
                                            onClick={() => copy(newAddress)}
                                            className={`btn-ghost ${styles.ghostAction}`}
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSeedSaved}
                                    className={`btn-glow ${styles.primaryAction} ${styles.fullWidth}`}
                                >
                                    I have saved my seed phrase
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Import wallet */}
                {!existingAddress && (
                    <div className={`pane-lite ${styles.card}`}>
                        <span className="section-label">Import Existing Wallet</span>
                        <p className={styles.cardDesc}>
                            Import an existing wallet using your 12 or 24-word seed phrase.
                        </p>

                        <div className={styles.field}>
                            <span className={styles.fieldLabel}>Seed Phrase</span>
                            <textarea
                                value={importMnemonic}
                                onChange={e => setImportMnemonic(e.target.value)}
                                placeholder="Enter your seed phrase (12 or 24 words)"
                                rows={3}
                                className={styles.textarea}
                            />
                        </div>

                        <button
                            onClick={handleImport}
                            disabled={isBusy || !importMnemonic.trim()}
                            className={`btn-glow ${styles.primaryAction} ${styles.fullWidth}`}
                        >
                            {isBusy ? "Importing..." : "Import Wallet"}
                        </button>
                    </div>
                )}

                {error && (
                    <div className={styles.error}>
                        <p className={styles.errorText}>{error}</p>
                    </div>
                )}
            </div>

            {showSendModal && cosmosAddress && (
                <SendModal
                    fromAddress={cosmosAddress}
                    usdcBalance={microToDecimal(BigInt(usdcBalanceAmount))}
                    onSend={handleSend}
                    onClose={() => setShowSendModal(false)}
                />
            )}

            {showKeysModal && existingAddress && (
                <WalletKeysModal
                    address={existingAddress}
                    onClose={() => setShowKeysModal(false)}
                    onCleared={() => {
                        setShowKeysModal(false);
                        setExistingAddress(null);
                        setNewMnemonic("");
                        setNewAddress("");
                    }}
                />
            )}
        </div>
    );
};

export default Wallet;
