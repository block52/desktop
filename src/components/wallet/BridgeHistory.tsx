import React from "react";
import { CopyButton } from "@block52/ui-sdk";
import { useBridgeHistory } from "../../hooks/useBridgeHistory";
import type { BridgeRow, BridgeStatus } from "../../utils/bridgeHistory";
import { usdc } from "../../utils/tournaments";
import EtherscanTxLink from "./EtherscanTxLink";
import styles from "./ActivityPanel.module.css";

interface BridgeHistoryProps {
    address: string;
    refreshToken?: number;
}

const PILL: Record<BridgeStatus, { text: string; className: string }> = {
    sent: { text: "SENT", className: styles.pillPending },
    minted: { text: "MINTED", className: styles.pillCompleted },
    skipped: { text: "SKIPPED", className: styles.pillPending }
};

const Row: React.FC<{ row: BridgeRow }> = ({ row }) => {
    const pill = PILL[row.status];
    return (
        <div className={styles.row}>
            <div className={styles.typeCell}>
                <span className={styles.typeText}>{row.token !== null ? `Bridge ${row.token}` : "Bridge"}</span>
                <span className={styles.typeTime}>{new Date(row.time).toLocaleString()}</span>
            </div>
            <span className={styles.detailCell}>
                {row.txHash !== null ? (
                    <>
                        <EtherscanTxLink hash={row.txHash} full />
                        <CopyButton text={row.txHash} message="Transaction hash copied" title="Copy transaction hash" />
                    </>
                ) : (
                    "Sent from another app or machine"
                )}
                {row.mintHeight !== null && ` · minted at block ${row.mintHeight.toLocaleString()}`}
                {row.reason !== null && row.reason !== "" && ` · ${row.reason}`}
            </span>
            <span className={`${styles.pill} ${pill.className}`}>{pill.text}</span>
            <span className={styles.amountCell}>+${usdc(row.amount)}</span>
        </div>
    );
};

/** Deposits bridged from Ethereum to this address: what this app sent, and everything the chain minted for it. */
const BridgeHistory: React.FC<BridgeHistoryProps> = ({ address, refreshToken = 0 }) => {
    const { rows, isLoading, error } = useBridgeHistory(address, refreshToken);
    return (
        <div className={`pane-lite ${styles.panel}`}>
            <div className={styles.gridHeader}>
                <span className="section-label">Type</span>
                <span className="section-label">Detail</span>
                <span className="section-label">Status</span>
                <span className={`section-label ${styles.amountHead}`}>Amount</span>
            </div>
            {isLoading && rows.length === 0 && (
                <div className={styles.stateBox}>
                    <div className={styles.spinner} />
                    <p className={styles.stateText}>Loading bridge history…</p>
                </div>
            )}
            {error !== "" && rows.length === 0 && (
                <div className={styles.stateBox}>
                    <p className={styles.stateText}>{error}</p>
                </div>
            )}
            {!isLoading && error === "" && rows.length === 0 && (
                <div className={styles.stateBox}>
                    <p className={styles.stateText}>No bridge deposits yet.</p>
                </div>
            )}
            {rows.map(row => (
                <Row key={row.key} row={row} />
            ))}
        </div>
    );
};

export default BridgeHistory;
