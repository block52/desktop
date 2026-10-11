import React, { useEffect, useState } from "react";
import { useNetwork } from "../../context/NetworkContext";
import { getCosmosClient } from "../../utils/cosmos/client";
import { TABLE_THEMES, type TableTheme } from "../../config/tableTheme";
import type { GameSettingKey, GameSettings } from "../../hooks/useGameSettings";
import styles from "./TableHeader.module.css";

export interface TableHeaderProps {
    tableLabel: string;
    /** Short variant label, e.g. "NLH". */
    variantLabel: string;
    smallBlind: string;
    bigBlind: string;
    handNumber: number;
    /** True when the connected wallet created this table. */
    isCreatedByYou?: boolean;
    onBack: () => void;
    /** Omitted when the viewer isn't seated — there is nothing to leave. */
    onLeave?: () => void;
    leaveDisabled: boolean;
    /** Opens the nav drawer (table screen hides the sidebar). */
    onOpenNav?: () => void;
    onToggleLog: () => void;
    /** Current table theme; with onCycleTheme shows the theme button. */
    theme?: TableTheme;
    onCycleTheme?: () => void;
    /** Play preferences; with onToggleSetting shows the settings menu. */
    settings?: GameSettings;
    onToggleSetting?: (key: GameSettingKey) => void;
}

const SETTING_ROWS: ReadonlyArray<{ key: GameSettingKey; label: string; hint: string }> = [
    { key: "turnNotificationSound", label: "Turn notification sound", hint: "Chime when it is your turn to act." },
    { key: "playerActionSounds", label: "Player action sounds", hint: "A sound for bets, calls, checks, folds and shows." },
    { key: "autoFold", label: "Auto fold on timeout", hint: "Fold (or check when it is free) when your clock runs out." },
    { key: "autoMuck", label: "Auto muck", hint: "Muck losing cards at showdown without asking." },
    { key: "preSelectCheck", label: "Pre-select check", hint: "Offer a Check box before your turn when checking is free." },
    { key: "autoPostBlinds", label: "Auto post blinds", hint: "Post your blind as soon as it is due." },
    { key: "autoDeal", label: "Auto deal", hint: "Deal the hand when it is your turn to." },
    { key: "autoNewHand", label: "Auto new hand", hint: "Start the next hand automatically." }
];

export const TableHeader: React.FC<TableHeaderProps> = ({
    tableLabel,
    variantLabel,
    smallBlind,
    bigBlind,
    handNumber,
    isCreatedByYou = false,
    onBack,
    onLeave,
    leaveDisabled,
    onOpenNav,
    onToggleLog,
    theme,
    onCycleTheme,
    settings,
    onToggleSetting
}) => {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const { currentNetwork } = useNetwork();
    const [blockHeight, setBlockHeight] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const fetchHeight = async () => {
            try {
                const client = getCosmosClient(currentNetwork);
                if (!client) return;
                const blocks = await client.getLatestBlocks(1);
                if (!cancelled && blocks.length > 0) {
                    setBlockHeight(blocks[0].block.header.height);
                }
            } catch {
                // Keep the last known height.
            }
        };
        void fetchHeight();
        const interval = setInterval(fetchHeight, 10000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [currentNetwork]);

    return (
        <div className={`pane ${styles.header}`}>
            {onOpenNav !== undefined && (
                <button
                    type="button"
                    className={`btn-ghost ${styles.menuButton}`}
                    onClick={onOpenNav}
                    aria-label="Open navigation"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M4 6h16" />
                        <path d="M4 12h16" />
                        <path d="M4 18h16" />
                    </svg>
                </button>
            )}
            <button className={`btn-ghost ${styles.backButton}`} onClick={onBack}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                </svg>
                Lobby
            </button>
            <div className={styles.titleBlock}>
                <span className={styles.tableName}>{tableLabel}</span>
                <span className={styles.subline}>
                    {variantLabel} · ${smallBlind} / ${bigBlind} · Hand #{handNumber}
                </span>
            </div>
            {isCreatedByYou && <span className={styles.creatorPill}>Created by you</span>}
            <span className={styles.verifiedPill}>
                <span className={styles.verifiedDot} />
                Shuffle verified
            </span>
            {blockHeight !== null && (
                <span className={styles.blockHeight}>#{Number(blockHeight).toLocaleString()}</span>
            )}
            <button type="button" className={`btn-ghost ${styles.menuButton}`} onClick={onToggleLog} aria-label="Hand log" title="Hand log">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M12 7v5l4 2" />
                </svg>
            </button>
            {settings !== undefined && onToggleSetting !== undefined && (
                <div className={styles.settingsWrap}>
                    <button
                        type="button"
                        className={`btn-ghost ${styles.menuButton}`}
                        onClick={() => setSettingsOpen(open => !open)}
                        aria-label="Table settings"
                        aria-expanded={settingsOpen}
                        title="Table settings"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 6h10" />
                            <path d="M18 6h2" />
                            <circle cx="16" cy="6" r="2" />
                            <path d="M4 12h2" />
                            <path d="M10 12h10" />
                            <circle cx="8" cy="12" r="2" />
                            <path d="M4 18h10" />
                            <path d="M18 18h2" />
                            <circle cx="16" cy="18" r="2" />
                        </svg>
                    </button>
                    {settingsOpen && (
                        <div className={`pane ${styles.settingsMenu}`} role="menu">
                            {SETTING_ROWS.map(row => (
                                <button
                                    key={row.key}
                                    type="button"
                                    role="menuitemcheckbox"
                                    aria-checked={settings[row.key]}
                                    className={styles.settingRow}
                                    onClick={() => onToggleSetting(row.key)}
                                >
                                    <span className={styles.settingText}>
                                        <span className={styles.settingLabel}>{row.label}</span>
                                        <span className={styles.settingHint}>{row.hint}</span>
                                    </span>
                                    <span className={`${styles.switch} ${settings[row.key] ? styles.switchOn : ""}`} aria-hidden="true" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {theme !== undefined && onCycleTheme !== undefined && (
                <button
                    type="button"
                    className={`btn-ghost ${styles.headerButton}`}
                    onClick={onCycleTheme}
                    title="Change table theme"
                    aria-label="Change table theme"
                >
                    {TABLE_THEMES.find(t => t.id === theme)?.label}
                </button>
            )}
            {onLeave !== undefined && (
                <button className={`btn-ghost ${styles.headerButton}`} onClick={onLeave} disabled={leaveDisabled}>
                    Leave Table
                </button>
            )}
        </div>
    );
};

export default TableHeader;
