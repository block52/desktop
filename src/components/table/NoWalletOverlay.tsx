import React from "react";
import styles from "./NoWalletOverlay.module.css";

export interface NoWalletOverlayProps {
    onConnect: () => void;
}

export const NoWalletOverlay: React.FC<NoWalletOverlayProps> = ({ onConnect }) => {
    return (
        <div className={styles.scrim}>
            <div className={styles.card}>
                <h3 className={styles.title}>Wallet not connected</h3>
                <p className={styles.body}>Create or import a Block52 wallet to join this table and play.</p>
                <button className={styles.button} onClick={onConnect}>
                    Connect Wallet
                </button>
            </div>
        </div>
    );
};

export default NoWalletOverlay;
