import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { WalletStatus } from "../../wallet/types";
import { clearCosmosData } from "../../utils/cosmos/storage";
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

const SEED_VISIBLE_MS = 60_000;

const WalletKeysModal: React.FC<WalletKeysModalProps> = ({ address, onClose, onCleared }) => {
    const navigate = useNavigate();
    const copy = useCopyToClipboard();
    const bridge = window.electronAPI?.wallet;
    const [status, setStatus] = useState<WalletStatus | null>(null);
    // The seed phrase is only fetched from the wallet when it is asked for, and dropped again after a minute.
    const [mnemonic, setMnemonic] = useState<string | null>(null);
    const [pendingReveal, setPendingReveal] = useState<"show" | "copy" | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        void bridge?.status().then(setStatus);
    }, [bridge]);

    useEffect(() => {
        if (mnemonic === null) return;
        const timer = setTimeout(() => setMnemonic(null), SEED_VISIBLE_MS);
        return () => clearTimeout(timer);
    }, [mnemonic]);

    const reveal = async (action: "show" | "copy") => {
        if (bridge === undefined) return;
        setError("");
        try {
            const revealed = await bridge.revealMnemonic();
            if (revealed === null) return;
            if (action === "show") setMnemonic(revealed);
            else await copy(revealed, "Seed phrase copied");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not reveal the seed phrase.");
        }
    };

    // With a password set, showing or copying the seed phrase asks for it again.
    const requestReveal = (action: "show" | "copy") => {
        if (action === "show" && mnemonic !== null) {
            setMnemonic(null);
            return;
        }
        if (status !== null && status.hasPassword) {
            setPendingReveal(action);
            return;
        }
        void reveal(action);
    };

    const handleConfirmed = () => {
        const action = pendingReveal;
        setPendingReveal(null);
        if (action !== null) void reveal(action);
    };

    const handleClear = async () => {
        if (!window.confirm("Clear your wallet? Make sure you have saved your seed phrase!")) return;
        await clearCosmosData();
        // Drop the signing client that still holds the old key in the main process.
        await clearSigningClientCache();
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

                {bridge !== undefined && (
                    <div className={styles.field}>
                        <div className={styles.seedHeaderRow}>
                            <span className={styles.fieldLabel}>Seed Phrase</span>
                            <div className={styles.seedHeaderButtons}>
                                <button onClick={() => requestReveal("show")} className={`btn-ghost ${styles.ghostAction}`}>
                                    {mnemonic !== null ? "Hide" : "Show"}
                                </button>
                                <button onClick={() => requestReveal("copy")} className={`btn-ghost ${styles.ghostAction}`}>
                                    Copy
                                </button>
                            </div>
                        </div>
                        {mnemonic !== null ? (
                            <SeedPhraseGrid mnemonic={mnemonic} />
                        ) : (
                            <p className={styles.noteText}>Hidden. Your seed phrase stays encrypted until you ask to see it.</p>
                        )}
                        {error !== "" && <span className={styles.errorText}>{error}</span>}
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
                    <button onClick={() => void handleClear()} className={styles.dangerAction}>
                        Clear Wallet
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WalletKeysModal;
