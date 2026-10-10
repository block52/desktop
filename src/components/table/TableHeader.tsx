import React, { useEffect, useState } from "react";
import { useNetwork } from "../../context/NetworkContext";
import { getCosmosClient } from "../../utils/cosmos/client";
import styles from "./TableHeader.module.css";

export interface TableHeaderProps {
    tableLabel: string;
    /** Short variant label, e.g. "NLH". */
    variantLabel: string;
    smallBlind: string;
    bigBlind: string;
    handNumber: number;
    onBack: () => void;
    /** Omitted when the viewer isn't seated — there is nothing to leave. */
    onLeave?: () => void;
    leaveDisabled: boolean;
    /** Opens the nav drawer (table screen hides the sidebar). */
    onOpenNav?: () => void;
    onToggleLog: () => void;
}

export const TableHeader: React.FC<TableHeaderProps> = ({
    tableLabel,
    variantLabel,
    smallBlind,
    bigBlind,
    handNumber,
    onBack,
    onLeave,
    leaveDisabled,
    onOpenNav,
    onToggleLog
}) => {
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
            {onLeave !== undefined && (
                <button className={`btn-ghost ${styles.headerButton}`} onClick={onLeave} disabled={leaveDisabled}>
                    Leave Table
                </button>
            )}
        </div>
    );
};

export default TableHeader;
