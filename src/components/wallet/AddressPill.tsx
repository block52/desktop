import { CopyButton } from "@block52/ui-sdk";
import styles from "./AddressPill.module.css";

interface AddressPillProps {
    address: string;
    /** Toast shown after copying. */
    copyMessage?: string;
    /** Tooltip and accessible name of the copy button. */
    copyTitle?: string;
}

/** An address in full (wrapping, never shortened) in a bordered box, with its copy button inside the box. */
const AddressPill: React.FC<AddressPillProps> = ({ address, copyMessage = "Address copied", copyTitle = "Copy address" }) => (
    <div className={styles.pill}>
        <code className={styles.address}>{address}</code>
        <CopyButton text={address} message={copyMessage} title={copyTitle} />
    </div>
);

export default AddressPill;
