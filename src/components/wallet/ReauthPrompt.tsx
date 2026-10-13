import { useState } from "react";
import type { FormEvent } from "react";
import type { WalletBridge } from "../../wallet/types";
import styles from "./WalletKeysModal.module.css";

interface ReauthPromptProps {
    bridge: WalletBridge;
    touchId: boolean;
    onConfirmed: () => void;
    onCancel: () => void;
}

/** Asks for the password (or Touch ID) again before the seed phrase is shown or copied. */
const ReauthPrompt: React.FC<ReauthPromptProps> = ({ bridge, touchId, onConfirmed, onCancel }) => {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isBusy, setIsBusy] = useState(false);

    const run = async (credential: { password: string } | { touchId: true }) => {
        setIsBusy(true);
        setError("");
        try {
            if (await bridge.authenticate(credential)) {
                onConfirmed();
                return;
            }
            setError("password" in credential ? "Wrong password." : "Touch ID did not confirm.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not confirm.");
        } finally {
            setIsBusy(false);
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (password !== "") void run({ password });
    };

    return (
        <form className={styles.field} onSubmit={submit}>
            <span className={styles.fieldLabel}>Enter your password to view the seed phrase</span>
            <div className={styles.fieldRow}>
                <input
                    type="password"
                    className={styles.textInput}
                    value={password}
                    autoFocus
                    autoComplete="current-password"
                    placeholder="Password"
                    onChange={event => setPassword(event.target.value)}
                    disabled={isBusy}
                />
                <button type="submit" className={`btn-ghost ${styles.ghostAction}`} disabled={isBusy || password === ""}>
                    Confirm
                </button>
                {touchId && (
                    <button type="button" className={`btn-ghost ${styles.ghostAction}`} disabled={isBusy} onClick={() => void run({ touchId: true })}>
                        Touch ID
                    </button>
                )}
                <button type="button" className={`btn-ghost ${styles.ghostAction}`} onClick={onCancel}>
                    Cancel
                </button>
            </div>
            {error !== "" && <span className={styles.errorText}>{error}</span>}
        </form>
    );
};

export default ReauthPrompt;
