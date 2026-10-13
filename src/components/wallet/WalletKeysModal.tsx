import { useEffect, useState } from "react";
import type { WalletStatus } from "../../wallet/types";
import { useNavigate } from "react-router-dom";
import { getCosmosMnemonic, clearCosmosData } from "../../utils/cosmos/storage";
import { clearCosmosClient, clearSigningClientCache } from "../../utils/cosmos/client";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import SeedPhraseGrid from "./SeedPhraseGrid";
import ReauthPrompt from "./ReauthPrompt";
import WalletSecurityPanel from "./WalletSecurityPanel";
import styles from "./WalletKeysModal.module.css";

interface WalletKeysModalProps {
    address: string;
    onClose: () => void;
    onCleared: () => void;
}

const WalletKeysModal: React.FC<WalletKeysModalProps> = ({ address, onClose, onCleared }) => {
    const navigate = useNavigate();
    const copy = useCopyToClipboard();
    const [mnemonic] = useState<string | null>(() => getCosmosMnemonic());
    const [showMnemonic, setShowMnemonic] = useState(false);
    const bridge = window.electronAPI?.wallet;
    const [status, setStatus] = useState<WalletStatus | null>(null);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [pendingReveal, setPendingReveal] = useState<"show" | "copy" | null>(null);

    useEffect(() => {
        void bridge?.status().then(setStatus);
    }, [bridge]);

    // With a password set, showing or copying the seed phrase asks for it again.
    const needsConfirmation = bridge !== undefined && status !== null && status.hasPassword && !isConfirmed;

    const revealAction = (action: "show" | "copy") => {
        if (needsConfirmation) {
            setPendingReveal(action);
            return;
        }
        if (action === "show") setShowMnemonic(v => !v);
        else if (mnemonic) void copy(mnemonic, "Seed phrase copied");
    };

    const handleConfirmed = () => {
        setIsConfirmed(true);
        if (pendingReveal === "show") setShowMnemonic(true);
        else if (pendingReveal === "copy" && mnemonic) void copy(mnemonic, "Seed phrase copied");
        setPendingReveal(null);
    };

    const handleClear = async () => {
        if (!window.confirm("Clear your wallet? Make sure you have saved your seed phrase!")) return;
        await clearCosmosData();
        // Drop the decrypted signer and client that still hold the old key in memory.
        clearSigningClientCache();
        clearCosmosClient();
        onCleared();
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div className={styles.overlay} onClick={handleOverlayClick}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Wallet keys</h2>
                    <button onClick={onClose} className={styles.closeButton} aria-label="Close">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.field}>
                    <span className={styles.fieldLabel}>Address</span>
                    <div className={styles.fieldRow}>
                        <input type="text" value={address} readOnly className={styles.input} />
                        <button onClick={() => void copy(address, "Address copied")} className={`btn-ghost ${styles.ghostAction}`}>
                            Copy
                        </button>
                    </div>
                </div>

                {mnemonic && (
                    <div className={styles.field}>
                        <div className={styles.seedHeaderRow}>
                            <span className={styles.fieldLabel}>Seed Phrase</span>
                            <div className={styles.seedHeaderButtons}>
                                <button onClick={() => revealAction("show")} className={`btn-ghost ${styles.ghostAction}`}>
                                    {showMnemonic ? "Hide" : "Show"}
                                </button>
                                <button onClick={() => revealAction("copy")} className={`btn-ghost ${styles.ghostAction}`}>
                                    Copy
                                </button>
                            </div>
                        </div>
                        <SeedPhraseGrid mnemonic={mnemonic} hidden={!showMnemonic} />
                    </div>
                )}

                {pendingReveal !== null && bridge !== undefined && status !== null && (
                    <ReauthPrompt
                        bridge={bridge}
                        touchId={status.touchIdEnabled && status.touchIdAvailable}
                        onConfirmed={handleConfirmed}
                        onCancel={() => setPendingReveal(null)}
                    />
                )}

                {bridge !== undefined && <WalletSecurityPanel bridge={bridge} />}

                <div className={styles.stack}>
                    <button
                        onClick={() => navigate("/")}
                        className={`btn-ghost ${styles.ghostAction} ${styles.fullWidth}`}
                    >
                        Return to Dashboard
                    </button>
                    <button onClick={handleClear} className={styles.dangerAction}>
                        Clear Wallet
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WalletKeysModal;
