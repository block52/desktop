import React, { useCallback, useMemo, useState } from "react";
import { COSMOS_CONSTANTS, MAX_GAME_NAME_LENGTH, computeGameNameFee } from "@block52/poker-vm-sdk";
import { useCosmosWallet } from "../../hooks/useCosmosWallet";
import { isValidTableName, sanitizeTableNameInput } from "../../utils/tableName";
import { createGame } from "../../hooks/createGame";
import { useNetwork } from "../../context/NetworkContext";
import { microToDecimal, parseUsdcToMicro } from "../../utils/currency";
import { CREATION_FEE_BIG_BLINDS, computeTableCreationFeeMicro } from "../../utils/tableCreationFee";
import {
    BLIND_LEVELS,
    BUY_IN_PRESETS,
    DEFAULT_BLIND_LEVEL_INDEX,
    SNG_BLINDS,
    SNG_BLIND_DURATIONS,
    SNG_STARTING_STACKS,
    validateBuyInBB
} from "../../config/tableOptions";
import Dropdown, { type DropdownOption } from "../dropdown/Dropdown";
import styles from "./CreateTableModal.module.css";

/** Matches the chain's default action timeout used by existing tables. */
const DEFAULT_TIMEOUT_SECONDS = 30;

type FormatChoice = "cash" | "sit-and-go";

interface CreateTableModalProps {
    onClose: () => void;
    onCreated: (gameId: string) => Promise<void> | void;
}

const toIndexOptions = <T,>(items: ReadonlyArray<T>, label: (item: T) => string): DropdownOption[] =>
    items.map((item, i) => ({ value: String(i), label: label(item) }));

const STACK_OPTIONS = toIndexOptions(SNG_STARTING_STACKS, s => s.label);
const SNG_BLIND_OPTIONS = toIndexOptions(SNG_BLINDS, b => `${b.smallBlind} / ${b.bigBlind}`);
const DURATION_OPTIONS = toIndexOptions(SNG_BLIND_DURATIONS, d => d.label);
const BLIND_LEVEL_OPTIONS = toIndexOptions(BLIND_LEVELS, l => l.label);
const VARIANT_OPTIONS: DropdownOption[] = [
    { value: "texas-holdem", label: "Texas Hold'em" },
    { value: "omaha", label: "Omaha", hint: "Coming soon", disabled: true },
    { value: "stud", label: "Seven Card Stud", hint: "Coming soon", disabled: true },
    { value: "blackjack", label: "Blackjack", hint: "Coming soon", disabled: true }
];

function tryParseMicro(value: string): bigint | null {
    try {
        return parseUsdcToMicro(value);
    } catch {
        return null;
    }
}

const CreateTableModal: React.FC<CreateTableModalProps> = ({ onClose, onCreated }) => {
    const { currentNetwork } = useNetwork();
    const { balance, isLoading: isBalanceLoading } = useCosmosWallet();

    const [name, setName] = useState("");
    const [format, setFormat] = useState<FormatChoice>("cash");
    const [minPlayers, setMinPlayers] = useState("2");
    const [maxPlayers, setMaxPlayers] = useState("9");
    // Cash
    const [blindLevelIndex, setBlindLevelIndex] = useState(DEFAULT_BLIND_LEVEL_INDEX);
    const [minBuyInBB, setMinBuyInBB] = useState("20");
    const [maxBuyInBB, setMaxBuyInBB] = useState("100");
    // Sit & Go
    const [entry, setEntry] = useState("1.00");
    const [startingStackIndex, setStartingStackIndex] = useState(1);
    const [sngBlindsIndex, setSngBlindsIndex] = useState(1);
    const [blindDurationIndex, setBlindDurationIndex] = useState(2);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isSng = format === "sit-and-go";
    const blindLevel = BLIND_LEVELS[blindLevelIndex];

    // Everything the chain will debit, in micro-USDC. Null while the form is not priceable.
    const pricing = useMemo(() => {
        if (isSng) {
            const bigBlind = BigInt(SNG_BLINDS[sngBlindsIndex].bigBlind);
            const entryMicro = tryParseMicro(entry);
            if (entryMicro === null) return null;
            const stack = BigInt(SNG_STARTING_STACKS[startingStackIndex].chips);
            return { creationFee: computeTableCreationFeeMicro(true, bigBlind, entryMicro, stack), bigBlindMicro: null };
        }
        const bigBlindMicro = tryParseMicro(blindLevel.bigBlind);
        if (bigBlindMicro === null) return null;
        return { creationFee: computeTableCreationFeeMicro(false, bigBlindMicro, 0n, null), bigBlindMicro };
    }, [isSng, sngBlindsIndex, entry, startingStackIndex, blindLevel]);

    const trimmedName = name.trim();
    const nameFeeMicro = trimmedName === "" ? 0n : computeGameNameFee(trimmedName);
    const creationFeeMicro = pricing === null ? null : pricing.creationFee;
    const totalMicro = creationFeeMicro === null ? null : creationFeeMicro + nameFeeMicro;
    const balanceMicro = BigInt(balance.find(b => b.denom === COSMOS_CONSTANTS.TOKEN_DENOM)?.amount ?? "0");
    const isInsufficient = !isBalanceLoading && totalMicro !== null && balanceMicro < totalMicro;

    const minBB = parseInt(minBuyInBB, 10);
    const maxBB = parseInt(maxBuyInBB, 10);
    const bigBlindMicro = pricing === null ? null : pricing.bigBlindMicro;
    const rangeValid = Number.isInteger(minBB) && Number.isInteger(maxBB) && bigBlindMicro !== null;

    const handleOverlayClick = useCallback(
        (e: React.MouseEvent) => {
            if (e.target === e.currentTarget) onClose();
        },
        [onClose]
    );

    const handleSubmit = async () => {
        setError("");

        if (trimmedName !== "" && !isValidTableName(trimmedName)) {
            setError("Table name must be lowercase letters, numbers and single hyphens (no leading or trailing hyphen)");
            return;
        }

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

        if (totalMicro === null) {
            setError("Check the blinds and entry amount — the creation fee could not be calculated");
            return;
        }
        if (isInsufficient) {
            setError(`You need $${microToDecimal(totalMicro)} USDC to create this table but only have $${microToDecimal(balanceMicro)}`);
            return;
        }

        try {
            let smallBlindAmount: bigint;
            let bigBlindAmount: bigint;
            let minBuyInAmount: bigint;
            let maxBuyInAmount: bigint;
            let sngConfig: { startingStack: bigint; blindLevelDuration: number; entryFee: bigint } | undefined;

            if (isSng) {
                const entryMicro = tryParseMicro(entry);
                if (entryMicro === null || entryMicro <= 0n) {
                    setError("Enter a valid entry amount");
                    return;
                }
                smallBlindAmount = BigInt(SNG_BLINDS[sngBlindsIndex].smallBlind);
                bigBlindAmount = BigInt(SNG_BLINDS[sngBlindsIndex].bigBlind);
                minBuyInAmount = entryMicro;
                maxBuyInAmount = entryMicro;
                sngConfig = {
                    startingStack: BigInt(SNG_STARTING_STACKS[startingStackIndex].chips),
                    blindLevelDuration: SNG_BLIND_DURATIONS[blindDurationIndex].minutes,
                    entryFee: 0n
                };
            } else {
                const rangeError = validateBuyInBB(minBB, maxBB);
                if (rangeError !== null) {
                    setError(rangeError);
                    return;
                }
                smallBlindAmount = parseUsdcToMicro(blindLevel.smallBlind);
                bigBlindAmount = parseUsdcToMicro(blindLevel.bigBlind);
                minBuyInAmount = bigBlindAmount * BigInt(minBB);
                maxBuyInAmount = bigBlindAmount * BigInt(maxBB);
            }

            setIsSubmitting(true);
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
                    sngConfig,
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
    };

    return (
        <div className={styles.overlay} onClick={handleOverlayClick}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Create table</h2>
                    <button onClick={onClose} className={styles.closeButton} aria-label="Close">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Game type</label>
                    <div className={styles.tokenRow}>
                        <button
                            onClick={() => setFormat("cash")}
                            className={format === "cash" ? styles.tokenButtonSelected : styles.tokenButton}
                        >
                            Cash game
                        </button>
                        <button
                            onClick={() => setFormat("sit-and-go")}
                            className={format === "sit-and-go" ? styles.tokenButtonSelected : styles.tokenButton}
                        >
                            Sit &amp; Go
                        </button>
                    </div>
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Table name (optional)</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(sanitizeTableNameInput(e.target.value))}
                        placeholder="e.g. friday-degens"
                        maxLength={MAX_GAME_NAME_LENGTH}
                        className={styles.input}
                    />
                    <p className={styles.inputHint}>
                        Free if left blank. Lowercase a–z, 0–9 and hyphens; $0.10 per character.
                    </p>
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

                {isSng ? (
                    <>
                        <div className={styles.field}>
                            <label className={styles.label}>Entry (USDC)</label>
                            <input
                                type="number"
                                value={entry}
                                onChange={e => setEntry(e.target.value)}
                                min="0"
                                step="0.01"
                                className={styles.input}
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Starting stack (chips)</label>
                            <Dropdown
                                value={String(startingStackIndex)}
                                options={STACK_OPTIONS}
                                onSelect={v => setStartingStackIndex(Number(v))}
                                placeholder="Starting stack"
                                allowEmpty={false}
                            />
                        </div>
                        <div className={styles.fieldRow}>
                            <div className={styles.field}>
                                <label className={styles.label}>Starting blinds (chips)</label>
                                <Dropdown
                                    value={String(sngBlindsIndex)}
                                    options={SNG_BLIND_OPTIONS}
                                    onSelect={v => setSngBlindsIndex(Number(v))}
                                    placeholder="Blinds"
                                    allowEmpty={false}
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Blind level duration</label>
                                <Dropdown
                                    value={String(blindDurationIndex)}
                                    options={DURATION_OPTIONS}
                                    onSelect={v => setBlindDurationIndex(Number(v))}
                                    placeholder="Duration"
                                    allowEmpty={false}
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={styles.field}>
                            <label className={styles.label}>Game size (small blind / big blind)</label>
                            <Dropdown
                                value={String(blindLevelIndex)}
                                options={BLIND_LEVEL_OPTIONS}
                                onSelect={v => setBlindLevelIndex(Number(v))}
                                placeholder="Game size"
                                allowEmpty={false}
                            />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Buy-in presets</label>
                            <div className={styles.tokenRow}>
                                {BUY_IN_PRESETS.map(preset => {
                                    const selected = minBB === preset.minBB && maxBB === preset.maxBB;
                                    return (
                                        <button
                                            key={preset.label}
                                            type="button"
                                            onClick={() => {
                                                setMinBuyInBB(String(preset.minBB));
                                                setMaxBuyInBB(String(preset.maxBB));
                                            }}
                                            className={selected ? styles.tokenButtonSelected : styles.tokenButton}
                                        >
                                            {preset.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className={styles.fieldRow}>
                            <div className={styles.field}>
                                <label className={styles.label}>Minimum buy-in (BB)</label>
                                <input
                                    type="number"
                                    value={minBuyInBB}
                                    onChange={e => setMinBuyInBB(e.target.value)}
                                    min="20"
                                    max="500"
                                    step="1"
                                    className={styles.input}
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Maximum buy-in (BB)</label>
                                <input
                                    type="number"
                                    value={maxBuyInBB}
                                    onChange={e => setMaxBuyInBB(e.target.value)}
                                    min="20"
                                    max="500"
                                    step="1"
                                    className={styles.input}
                                />
                            </div>
                        </div>

                        {rangeValid && (
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Calculated buy-in range</span>
                                <span className={styles.infoRange}>
                                    ${microToDecimal(bigBlindMicro * BigInt(minBB))} – ${microToDecimal(bigBlindMicro * BigInt(maxBB))}
                                </span>
                                <span className={styles.infoSub}>Based on ${microToDecimal(bigBlindMicro)} big blind</span>
                            </div>
                        )}
                    </>
                )}

                <div className={styles.field}>
                    <label className={styles.label}>Variant</label>
                    <Dropdown
                        value="texas-holdem"
                        options={VARIANT_OPTIONS}
                        onSelect={() => undefined}
                        placeholder="Variant"
                        allowEmpty={false}
                        align="up"
                    />
                </div>

                <div className={styles.feeBox}>
                    <div className={styles.feeRow}>
                        <span>Table creation fee ({CREATION_FEE_BIG_BLINDS.toString()} big blinds)</span>
                        <span className={styles.feeValue}>
                            {creationFeeMicro === null ? "—" : `$${microToDecimal(creationFeeMicro)}`}
                        </span>
                    </div>
                    {nameFeeMicro > 0n && (
                        <div className={styles.feeRow}>
                            <span>Table name ({trimmedName.length} characters)</span>
                            <span className={styles.feeValue}>${microToDecimal(nameFeeMicro)}</span>
                        </div>
                    )}
                    <div className={styles.feeRow}>
                        <span>Your balance</span>
                        <span className={styles.feeValue}>${microToDecimal(balanceMicro)}</span>
                    </div>
                </div>

                {isInsufficient && totalMicro !== null && (
                    <div className={styles.errorBanner}>
                        You need ${microToDecimal(totalMicro)} USDC to create this table; your balance is ${microToDecimal(balanceMicro)}.
                    </div>
                )}

                {error && <div className={styles.errorBanner}>{error}</div>}

                <div className={styles.actions}>
                    <button onClick={onClose} className={styles.cancelButton}>
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || isInsufficient}
                        className={styles.primaryButton}
                    >
                        {isSubmitting ? "Creating…" : "Create game"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateTableModal;
