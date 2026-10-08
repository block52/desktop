import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
    clearCosmosData
} from "../utils/cosmos/storage";
import { useCosmosWallet } from "../hooks/useCosmosWallet";
import { useNetwork } from "../context/NetworkContext";
import GameWallet from "../components/gameWallet/GameWallet";
import SendModal from "../components/modal/SendModal";
import WithdrawModal from "../components/modal/WithdrawModal";
import DepositModal from "../components/modal/DepositModal";
import styles from "./Wallet.module.css";

const SeedPhraseGrid = ({ mnemonic, hidden = false }: { mnemonic: string; hidden?: boolean }) => {
    const words = mnemonic.split(" ");
    return (
        <div className={styles.seedGrid}>
            {words.map((word, index) => (
                <div key={index} className={styles.seedWord}>
                    <span className={styles.seedIndex}>{index + 1}.</span>
                    <span className={styles.seedText}>{hidden ? "••••" : word}</span>
                </div>
            ))}
        </div>
    );
};

const Wallet: React.FC = () => {
    const navigate = useNavigate();
    const { address: cosmosAddress, balance, refreshBalance } = useCosmosWallet();
    const { currentNetwork } = useNetwork();

    const [showSendModal, setShowSendModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [showDepositModal, setShowDepositModal] = useState(false);

    const usdcBalanceAmount =
        balance.find(b => b.denom === COSMOS_CONSTANTS.TOKEN_DENOM)?.amount ?? "0";

    const handleSend = useCallback(
        async (recipient: string, amountUsdc: number): Promise<string> => {
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

            const amountMicro = BigInt(
                Math.floor(amountUsdc * Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)),
            );
            return signingClient.sendTokens(
                fromAddress,
                recipient,
                amountMicro,
                COSMOS_CONSTANTS.TOKEN_DENOM,
            );
        },
        [currentNetwork],
    );

    const [existingMnemonic, setExistingMnemonic] = useState<string | null>(null);
    const [existingAddress, setExistingAddress] = useState<string | null>(null);
    const [showMnemonic, setShowMnemonic] = useState(false);

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

            if (mnemonic && !address) {
                try {
                    address = await getAddressFromMnemonic(mnemonic, "b52");
                    setCosmosAddress(address);
                } catch (err) {
                    console.error("Failed to derive address:", err);
                }
            }

            setExistingMnemonic(mnemonic);
            setExistingAddress(address);
            setIsLoading(false);
        };

        load();
    }, []);

    const handleGenerate = async () => {
        setIsBusy(true);
        setError("");
        try {
            const wallet = await generateWallet("b52", 24);
            setCosmosMnemonic(wallet.mnemonic);
            setCosmosAddress(wallet.address);
            setNewMnemonic(wallet.mnemonic);
            setNewAddress(wallet.address);
            setExistingMnemonic(wallet.mnemonic);
            setExistingAddress(wallet.address);
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
            setCosmosMnemonic(importMnemonic.trim());
            setCosmosAddress(wallet.address);
            setExistingMnemonic(importMnemonic.trim());
            setExistingAddress(wallet.address);
            setImportMnemonic("");
        } catch (err) {
            console.error("Import wallet failed:", err);
            setError("Failed to import wallet. Check your seed phrase.");
        } finally {
            setIsBusy(false);
        }
    };

    const handleClear = () => {
        if (!window.confirm("Clear your wallet? Make sure you have saved your seed phrase!")) return;
        clearCosmosData();
        setExistingMnemonic(null);
        setExistingAddress(null);
        setNewMnemonic("");
        setNewAddress("");
        setShowMnemonic(false);
    };

    const copy = (text: string) => navigator.clipboard.writeText(text);

    if (isLoading) {
        return <div className={styles.loading}>Loading wallet...</div>;
    }

    return (
        <div className={styles.page}>
            <div className={styles.inner}>
                <h1 className={styles.pageTitle}>Block52 Wallet</h1>
                <p className={styles.pageSubtitle}>Generate or import a wallet to play poker</p>

                {/* Game wallet — balance, deposit/withdraw/send, web3 connect */}
                {existingAddress && (
                    <div style={{ marginBottom: 16 }}>
                        <GameWallet
                            cosmosAddress={cosmosAddress}
                            usdcBalance={usdcBalanceAmount}
                            onDeposit={() => setShowDepositModal(true)}
                            onWithdraw={() => setShowWithdrawModal(true)}
                            onSend={() => setShowSendModal(true)}
                            onCreateWallet={() => {}}
                            onImportWallet={() => {}}
                            onRefresh={refreshBalance}
                        />
                    </div>
                )}

                {/* Current wallet */}
                {existingAddress && (
                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>Current Wallet</h2>

                        <div style={{ marginTop: 12 }}>
                            <span className={styles.fieldLabel}>Address</span>
                            <div className={styles.fieldRow}>
                                <input
                                    type="text"
                                    value={existingAddress}
                                    readOnly
                                    className={styles.input}
                                />
                                <button
                                    onClick={() => copy(existingAddress)}
                                    className={styles.secondaryButton}
                                >
                                    Copy
                                </button>
                            </div>
                        </div>

                        {existingMnemonic && (
                            <div>
                                <div className={styles.seedHeaderRow}>
                                    <span className={styles.fieldLabel}>Seed Phrase</span>
                                    <div className={styles.seedHeaderButtons}>
                                        <button
                                            onClick={() => setShowMnemonic(v => !v)}
                                            className={styles.secondaryButton}
                                        >
                                            {showMnemonic ? "Hide" : "Show"}
                                        </button>
                                        <button
                                            onClick={() => copy(existingMnemonic)}
                                            className={styles.secondaryButton}
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>
                                <SeedPhraseGrid mnemonic={existingMnemonic} hidden={!showMnemonic} />
                            </div>
                        )}

                        <div className={styles.stack}>
                            <button
                                onClick={() => navigate("/")}
                                className={`${styles.primaryButton} ${styles.fullWidth}`}
                            >
                                Return to Dashboard
                            </button>
                            <button onClick={handleClear} className={styles.dangerButton}>
                                Clear Wallet
                            </button>
                        </div>
                    </div>
                )}

                {/* Generate new wallet */}
                {!existingAddress && (
                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>Generate New Wallet</h2>
                        <p className={styles.cardDesc}>
                            Create a new Block52 wallet with a 24-word seed phrase.
                        </p>

                        <button
                            onClick={handleGenerate}
                            disabled={isBusy}
                            className={`${styles.primaryButton} ${styles.fullWidth}`}
                        >
                            {isBusy ? "Generating..." : "Generate New Wallet"}
                        </button>

                        {newMnemonic && (
                            <div style={{ marginTop: 16 }}>
                                <div className={styles.warning}>
                                    <p className={styles.warningTitle}>⚠️ Important</p>
                                    <p className={styles.warningText}>
                                        Write down your seed phrase and store it safely. This is the only way to recover your wallet.
                                    </p>
                                </div>

                                <div className={styles.seedHeaderRow}>
                                    <span className={styles.fieldLabel}>Your Seed Phrase</span>
                                    <button
                                        onClick={() => copy(newMnemonic)}
                                        className={styles.secondaryButton}
                                    >
                                        Copy
                                    </button>
                                </div>
                                <SeedPhraseGrid mnemonic={newMnemonic} />

                                <div style={{ marginTop: 12 }}>
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
                                            className={styles.secondaryButton}
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Import wallet */}
                {!existingAddress && (
                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>Import Existing Wallet</h2>
                        <p className={styles.cardDesc}>
                            Import an existing wallet using your 12 or 24-word seed phrase.
                        </p>

                        <span className={styles.fieldLabel}>Seed Phrase</span>
                        <textarea
                            value={importMnemonic}
                            onChange={e => setImportMnemonic(e.target.value)}
                            placeholder="Enter your seed phrase (12 or 24 words)"
                            rows={3}
                            className={styles.textarea}
                        />

                        <button
                            onClick={handleImport}
                            disabled={isBusy || !importMnemonic.trim()}
                            className={`${styles.primaryButton} ${styles.fullWidth}`}
                            style={{ marginTop: 12 }}
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
                    usdcBalance={usdcBalanceAmount}
                    onSend={handleSend}
                    onClose={() => setShowSendModal(false)}
                />
            )}

            {showWithdrawModal && (
                <WithdrawModal
                    usdcBalance={usdcBalanceAmount}
                    onClose={() => setShowWithdrawModal(false)}
                />
            )}

            {showDepositModal && cosmosAddress && (
                <DepositModal
                    cosmosAddress={cosmosAddress}
                    onClose={() => setShowDepositModal(false)}
                    onDepositConfirmed={refreshBalance}
                />
            )}
        </div>
    );
};

export default Wallet;
