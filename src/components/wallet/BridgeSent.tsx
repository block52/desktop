import React from "react";
import { CopyButton } from "@block52/ui-sdk";
import { useAvgBlockTime } from "../../hooks/useAvgBlockTime";
import { useBlockHeight } from "../../hooks/useBlockHeight";
import { mintProgress } from "../../utils/bridgeSync";
import dialog from "../modal/TableDialog.module.css";
import EtherscanTxLink from "./EtherscanTxLink";
import styles from "./EthDepositPanel.module.css";

interface BridgeSentProps {
    approveHash: string | null;
    depositHash: string;
}

const FALLBACK_BLOCK_SECONDS = 5;

function Hash({ label, hash }: { label: string; hash: string }) {
    return (
        <div className={styles.sentHash}>
            <span className={styles.sentLabel}>{label}</span>
            <EtherscanTxLink hash={hash} />
            <CopyButton text={hash} message="Transaction hash copied" title={`Copy ${label.toLowerCase()} transaction hash`} />
        </div>
    );
}

/**
 * After a bridge deposit: the Ethereum transaction to debug with, and a bar counting blocks to the next 50-block sync that
 * mints it. The bar is driven by block height, so it stays right if the app missed blocks.
 */
const BridgeSent: React.FC<BridgeSentProps> = ({ approveHash, depositHash }) => {
    // The deposit is already mined on Ethereum when this shows, so the first height seen is where it starts.
    const { first, latest } = useBlockHeight(true);
    const { avgBlockTimeSeconds } = useAvgBlockTime();

    const progress = first !== null && latest !== null ? mintProgress(first, latest) : null;
    const minutes = progress === null ? 0 : Math.max(1, Math.round((progress.blocksLeft * (avgBlockTimeSeconds ?? FALLBACK_BLOCK_SECONDS)) / 60));

    return (
        <div className={styles.sent}>
            <p className={dialog.body}>Sent. Your Block52 balance updates once the bridge has minted it.</p>
            {approveHash !== null && <Hash label="Approval" hash={approveHash} />}
            <Hash label="Deposit" hash={depositHash} />
            {progress !== null && (
                <div className={styles.progress}>
                    <div className={styles.progressText}>
                        <span>
                            {progress.reached
                                ? "Sync block reached. Your balance should update shortly."
                                : `Minting in ${progress.blocksLeft} ${progress.blocksLeft === 1 ? "block" : "blocks"} (about ${minutes} min)`}
                        </span>
                        <span>{progress.percent}%</span>
                    </div>
                    <div className={styles.progressTrack} role="progressbar" aria-label="Minting progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
                        <div className={styles.progressFill} style={{ width: `${progress.percent}%` }} />
                    </div>
                    <p className={styles.progressNote}>
                        Deposits are picked up every 50 blocks, at block {progress.target.toLocaleString()}. If it is not there by then, it lands in the next one.
                    </p>
                </div>
            )}
        </div>
    );
};

export default BridgeSent;
