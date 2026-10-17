import React from "react";
import Tooltip from "../tooltip/Tooltip";
import styles from "./EtherscanTxLink.module.css";

interface EtherscanTxLinkProps {
    hash: string;
}

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

function openLink(url: string): void {
    if (window.electronAPI !== undefined) {
        window.electronAPI.openExternal(url);
    } else {
        window.open(url, "_blank", "noopener,noreferrer");
    }
}

/** An Ethereum mainnet transaction: the shortened hash and a button that opens it on Etherscan in the system browser. */
const EtherscanTxLink: React.FC<EtherscanTxLinkProps> = ({ hash }) => {
    if (!TX_HASH.test(hash)) return <p className={styles.hash}>Tx: {hash.slice(0, 18)}…</p>;

    return (
        <div className={styles.row}>
            <span className={styles.hash}>
                Tx: {hash.slice(0, 10)}…{hash.slice(-6)}
            </span>
            <Tooltip
                card
                content={
                    <>
                        <span className={styles.previewSite}>etherscan.io</span>
                        <span className={styles.previewHash}>
                            {hash.slice(0, 14)}…{hash.slice(-10)}
                        </span>
                        <span className={styles.previewNote}>Opens in your browser</span>
                    </>
                }
            >
                <button type="button" className={styles.link} onClick={() => openLink(`https://etherscan.io/tx/${hash}`)}>
                    View on Etherscan
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M7 17 17 7" />
                        <path d="M8 7h9v9" />
                    </svg>
                </button>
            </Tooltip>
        </div>
    );
};

export default EtherscanTxLink;
