import React from "react";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import styles from "./CopyButton.module.css";

interface CopyButtonProps {
    text: string;
    message?: string;
    title?: string;
    className?: string;
}

const CopyIcon: React.FC = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

const CopyButton: React.FC<CopyButtonProps> = ({ text, message, title = "Copy", className }) => {
    const copy = useCopyToClipboard();

    return (
        <button
            type="button"
            className={`${styles.copyButton}${className ? ` ${className}` : ""}`}
            title={title}
            aria-label={title}
            onClick={e => {
                e.stopPropagation();
                void copy(text, message);
            }}
        >
            <CopyIcon />
        </button>
    );
};

export default CopyButton;
