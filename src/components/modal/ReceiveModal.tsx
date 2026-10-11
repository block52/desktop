import React from "react";
import { QRCodeSVG } from "qrcode.react";
import CopyButton from "../copyButton/CopyButton";
import dialog from "./TableDialog.module.css";
import styles from "./ReceiveModal.module.css";

interface ReceiveModalProps {
    /** The Block52 address to receive b52USDC at. */
    address: string;
    onClose: () => void;
}

export const ReceiveModal: React.FC<ReceiveModalProps> = ({ address, onClose }) => (
    <div className={dialog.overlay} onClick={onClose} role="presentation">
        <div className={dialog.modal} role="dialog" aria-modal="true" aria-label="Receive" onClick={e => e.stopPropagation()}>
            <h2 className={dialog.title}>Receive</h2>
            <p className={dialog.body}>Scan this from another Block52 wallet, or copy the address, to send b52USDC to this wallet.</p>
            <div className={styles.qr}>
                <QRCodeSVG value={address} size={200} level="M" marginSize={2} />
            </div>
            <div className={styles.address}>
                <code>{address}</code>
                <CopyButton text={address} message="Address copied" title="Copy address" />
            </div>
            <div className={dialog.actions}>
                <button type="button" className={`btn-ghost ${dialog.action}`} onClick={onClose}>
                    Close
                </button>
            </div>
        </div>
    </div>
);

export default ReceiveModal;
