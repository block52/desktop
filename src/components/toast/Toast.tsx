import React from "react";
import styles from "./Toast.module.css";
import type { ToastItem } from "../../context/ToastContext";

const icons: Record<ToastItem["type"], React.ReactNode> = {
    success: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        </svg>
    ),
    error: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
    ),
    warning: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
    ),
    info: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01" />
        </svg>
    ),
};

interface ToastListProps {
    toasts: ToastItem[];
}

const ToastList: React.FC<ToastListProps> = ({ toasts }) => {
    if (toasts.length === 0) return null;

    return (
        <div className={styles.container}>
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`${styles.toast} ${styles[t.type]} ${t.hiding ? styles.hiding : ""}`}
                >
                    <span className={`${styles.icon} ${styles[t.type]}`}>{icons[t.type]}</span>
                    <span className={styles.message}>{t.message}</span>
                </div>
            ))}
        </div>
    );
};

export default ToastList;
