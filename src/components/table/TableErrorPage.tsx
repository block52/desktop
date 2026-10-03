import React from "react";
import styles from "./TableErrorPage.module.css";

export interface TableErrorPageProps {
    message: string;
    onRetry: () => void;
}

export const TableErrorPage: React.FC<TableErrorPageProps> = ({ message, onRetry }) => {
    return (
        <div className={styles.state}>
            <div className={styles.icon}>!</div>
            <h3 className={styles.title}>Couldn't connect to this table</h3>
            <p className={styles.body}>{message}</p>
            <button className={styles.button} onClick={onRetry}>
                Retry
            </button>
        </div>
    );
};

export default TableErrorPage;
