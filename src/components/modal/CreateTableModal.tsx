import React, { useCallback, useState } from "react";
import { MAX_GAME_NAME_LENGTH } from "@block52/poker-vm-sdk";
import { createGame } from "../../hooks/createGame";
import { useNetwork } from "../../context/NetworkContext";
import { parseUsdcToMicro } from "../../utils/currency";
import styles from "./CreateTableModal.module.css";

/** Matches the chain's default action timeout used by existing tables. */
const DEFAULT_TIMEOUT_SECONDS = 30;

type FormatChoice = "cash" | "sit-and-go";

interface CreateTableModalProps {
    onClose: () => void;
    onCreated: (gameId: string) => Promise<void> | void;
}

const CreateTableModal: React.FC<CreateTableModalProps> = ({ onClose, onCreated }) => {
    const { currentNetwork } = useNetwork();

    const [name, setName] = useState("");
    const [format, setFormat] = useState<FormatChoice>("cash");
    const [minPlayers, setMinPlayers] = useState("2");
    const [maxPlayers, setMaxPlayers] = useState("6");
    const [smallBlind, setSmallBlind] = useState("0.01");
    const [bigBlind, setBigBlind] = useState("0.02");
    const [minBuyIn, setMinBuyIn] = useState("1.00");
    const [maxBuyIn, setMaxBuyIn] = useState("2.00");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleOverlayClick = useCallback(
        (e: React.MouseEvent) => {
            if (e.target === e.currentTarget) onClose();
        },
        [onClose]
    );

    const handleSubmit = useCallback(async () => {
        setError("");

        const minSeats = parseInt(minPlayers, 10);
        const maxSeats = parseInt(maxPlayers, 10);
        if (!Number.isInteger(minSeats) || minSeats < 2) {
            setError("Min players must be at least 2");
            return;
        }
        if (!Number.isInteger(maxSeats) || maxSeats < minSeats || maxSeats > 10) {
            setError("Max players must be between min players and 10");
            return;
        }

        try {
            const isSng = format === "sit-and-go";
            // Cash blinds are USDC amounts (micro); Sit & Go blinds are chip counts.
            const smallBlindAmount = isSng ? BigInt(smallBlind) : parseUsdcToMicro(smallBlind);
            const bigBlindAmount = isSng ? BigInt(bigBlind) : parseUsdcToMicro(bigBlind);
            const minBuyInAmount = parseUsdcToMicro(minBuyIn);
            const maxBuyInAmount = isSng ? minBuyInAmount : parseUsdcToMicro(maxBuyIn);

            if (maxBuyInAmount < minBuyInAmount) {
                setError("Max buy-in must be at least the min buy-in");
                return;
            }

            setIsSubmitting(true);
            const trimmedName = name.trim();
            const gameId = await createGame(
                {
                    gameFormat: format,
                    gameVariant: "texas-holdem",
                    minPlayers: minSeats,
                    maxPlayers: maxSeats,
                    minBuyIn: minBuyInAmount,
                    maxBuyIn: maxBuyInAmount,
                    smallBlind: smallBlindAmount,
                    bigBlind: bigBlindAmount,
                    timeout: DEFAULT_TIMEOUT_SECONDS,
                    name: trimmedName === "" ? undefined : trimmedName
                },
                currentNetwork
            );
            await onCreated(gameId);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create table");
            setIsSubmitting(false);
        }
    }, [name, format, minPlayers, maxPlayers, smallBlind, bigBlind, minBuyIn, maxBuyIn, currentNetwork, onCreated, onClose]);

    return (
        <div className={styles.overlay} onClick={handleOverlayClick}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Create table</h2>
                    <button onClick={onClose} className={styles.closeButton}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Table name (optional)</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Friday Degens"
                        maxLength={MAX_GAME_NAME_LENGTH}
                        className={styles.input}
                    />
                    <p className={styles.inputHint}>
                        {name.length}/{MAX_GAME_NAME_LENGTH} — named tables cost $0.10 per character
                    </p>
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Format</label>
                    <div className={styles.tokenRow}>
                        <button
                            onClick={() => setFormat("cash")}
                            className={format === "cash" ? styles.tokenButtonSelected : styles.tokenButton}
                        >
                            Cash
                        </button>
                        <button
                            onClick={() => setFormat("sit-and-go")}
                            className={format === "sit-and-go" ? styles.tokenButtonSelected : styles.tokenButton}
                        >
                            Sit &amp; Go
                        </button>
                    </div>
                </div>

                <div className={styles.fieldRow}>
                    <div className={styles.field}>
                        <label className={styles.label}>Min players</label>
                        <input
                            type="number"
                            value={minPlayers}
                            onChange={e => setMinPlayers(e.target.value)}
                            min="2"
                            step="1"
                            className={styles.input}
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Max players</label>
                        <input
                            type="number"
                            value={maxPlayers}
                            onChange={e => setMaxPlayers(e.target.value)}
                            min="2"
                            max="10"
                            step="1"
                            className={styles.input}
                        />
                    </div>
                </div>

                <div className={styles.fieldRow}>
                    <div className={styles.field}>
                        <label className={styles.label}>
                            Small blind{format === "sit-and-go" ? " (chips)" : " (USDC)"}
                        </label>
                        <input
                            type="number"
                            value={smallBlind}
                            onChange={e => setSmallBlind(e.target.value)}
                            min="0"
                            step={format === "sit-and-go" ? "1" : "0.01"}
                            className={styles.input}
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>
                            Big blind{format === "sit-and-go" ? " (chips)" : " (USDC)"}
                        </label>
                        <input
                            type="number"
                            value={bigBlind}
                            onChange={e => setBigBlind(e.target.value)}
                            min="0"
                            step={format === "sit-and-go" ? "1" : "0.01"}
                            className={styles.input}
                        />
                    </div>
                </div>

                {format === "cash" ? (
                    <div className={styles.fieldRow}>
                        <div className={styles.field}>
                            <label className={styles.label}>Min buy-in (USDC)</label>
                            <input
                                type="number"
                                value={minBuyIn}
                                onChange={e => setMinBuyIn(e.target.value)}
                                min="0"
                                step="0.01"
                                className={styles.input}
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Max buy-in (USDC)</label>
                            <input
                                type="number"
                                value={maxBuyIn}
                                onChange={e => setMaxBuyIn(e.target.value)}
                                min="0"
                                step="0.01"
                                className={styles.input}
                            />
                        </div>
                    </div>
                ) : (
                    <div className={styles.field}>
                        <label className={styles.label}>Entry (USDC)</label>
                        <input
                            type="number"
                            value={minBuyIn}
                            onChange={e => setMinBuyIn(e.target.value)}
                            min="0"
                            step="0.01"
                            className={styles.input}
                        />
                    </div>
                )}

                {error && <div className={styles.errorBanner}>{error}</div>}

                <div className={styles.actions}>
                    <button onClick={onClose} className={styles.cancelButton}>
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className={styles.primaryButton}>
                        {isSubmitting ? "Creating…" : "Create table"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateTableModal;
