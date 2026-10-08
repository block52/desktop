import React from "react";
import styles from "./TableErrorPage.module.css";

export interface TableErrorPageProps {
    message: string;
    onRetry: () => void;
    onBack: () => void;
}

export const TableErrorPage: React.FC<TableErrorPageProps> = ({ message, onRetry, onBack }) => {
    return (
        <div className={styles.state}>
            <div className={styles.icon}>!</div>
            <h3 className={styles.title}>Couldn't connect to this table</h3>
            <p className={styles.body}>{message}</p>
            <div className={styles.actions}>
                <button className={styles.button} onClick={onRetry}>
                    Retry
                </button>
                <button className={styles.backButton} onClick={onBack}>
                    Back to Home
                </button>
            </div>
        </div>
    );
};

export default TableErrorPage;
