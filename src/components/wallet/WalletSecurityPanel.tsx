import { useCallback, useEffect, useState } from "react";
import type { WalletBridge, WalletStatus } from "../../wallet/types";
import styles from "./WalletKeysModal.module.css";

interface WalletSecurityPanelProps {
    bridge: WalletBridge;
}

type Editing = "none" | "set" | "change" | "remove";

const AUTO_LOCK_OPTIONS = [
    { minutes: 5, label: "5 minutes" },
    { minutes: 15, label: "15 minutes" },
    { minutes: 30, label: "30 minutes" },
    { minutes: 60, label: "1 hour" },
    { minutes: 0, label: "Never" },
];

const WalletSecurityPanel: React.FC<WalletSecurityPanelProps> = ({ bridge }) => {
    const [status, setStatus] = useState<WalletStatus | null>(null);
    const [editing, setEditing] = useState<Editing>("none");
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [isBusy, setIsBusy] = useState(false);

    const refresh = useCallback(async () => setStatus(await bridge.status()), [bridge]);

    useEffect(() => {
        void bridge.status().then(setStatus);
    }, [bridge]);

    const closeForm = () => {
        setEditing("none");
        setCurrent("");
        setNext("");
        setConfirm("");
        setError("");
    };

    const run = async (action: () => Promise<void>, closes: boolean) => {
        setIsBusy(true);
        setError("");
        try {
            await action();
            await refresh();
            if (closes) closeForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : "That did not work.");
        } finally {
            setIsBusy(false);
        }
    };

    const submitForm = () => {
        if (editing === "remove") return run(() => bridge.removePassword(current), true);
        if (next !== confirm) {
            setError("The two passwords do not match.");
            return;
        }
        if (editing === "set") return run(() => bridge.setPassword(next), true);
        return run(() => bridge.changePassword(current, next), true);
    };

    if (status === null || !status.exists) return null;

    return (
        <div className={styles.field}>
            <span className={styles.fieldLabel}>Security</span>
            <p className={styles.noteText}>
                {status.osProtected
                    ? "Your seed phrase is encrypted and kept in your operating system's secure storage."
                    : "This computer has no secure storage available, so the seed phrase is only obfuscated. Set a password to protect it."}
            </p>

            {editing === "none" && (
                <div className={styles.fieldRow}>
                    {!status.hasPassword && (
                        <button className={`btn-ghost ${styles.ghostAction}`} onClick={() => setEditing("set")}>
                            Set password
                        </button>
                    )}
                    {status.hasPassword && (
                        <>
                            <button className={`btn-ghost ${styles.ghostAction}`} onClick={() => setEditing("change")}>
                                Change password
                            </button>
                            <button className={`btn-ghost ${styles.ghostAction}`} onClick={() => setEditing("remove")}>
                                Remove password
                            </button>
                            <button className={`btn-ghost ${styles.ghostAction}`} onClick={() => void bridge.lock()}>
                                Lock now
                            </button>
                        </>
                    )}
                </div>
            )}

            {editing !== "none" && (
                <form
                    className={styles.stack}
                    onSubmit={event => {
                        event.preventDefault();
                        void submitForm();
                    }}
                >
                    {editing !== "set" && (
                        <input
                            type="password"
                            className={styles.textInput}
                            placeholder="Current password"
                            autoComplete="current-password"
                            value={current}
                            onChange={event => setCurrent(event.target.value)}
                        />
                    )}
                    {editing !== "remove" && (
                        <>
                            <input
                                type="password"
                                className={styles.textInput}
                                placeholder="New password (8+ characters)"
                                autoComplete="new-password"
                                value={next}
                                onChange={event => setNext(event.target.value)}
                            />
                            <input
                                type="password"
                                className={styles.textInput}
                                placeholder="Repeat new password"
                                autoComplete="new-password"
                                value={confirm}
                                onChange={event => setConfirm(event.target.value)}
                            />
                        </>
                    )}
                    {editing === "set" && (
                        <p className={styles.noteText}>There is no way to recover this password. Your seed phrase backup is the only way back in.</p>
                    )}
                    {error !== "" && <span className={styles.errorText}>{error}</span>}
                    <div className={styles.fieldRow}>
                        <button type="submit" className={`btn-ghost ${styles.ghostAction}`} disabled={isBusy}>
                            {editing === "remove" ? "Remove password" : "Save password"}
                        </button>
                        <button type="button" className={`btn-ghost ${styles.ghostAction}`} onClick={closeForm}>
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {editing === "none" && error !== "" && <span className={styles.errorText}>{error}</span>}

            {status.hasPassword && editing === "none" && (
                <>
                    <label className={styles.optionRow}>
                        <span>Auto-lock after</span>
                        <select
                            className={styles.select}
                            value={status.autoLockMinutes}
                            disabled={isBusy}
                            onChange={event => void run(() => bridge.setAutoLock(Number(event.target.value)), false)}
                        >
                            {AUTO_LOCK_OPTIONS.map(option => (
                                <option key={option.minutes} value={option.minutes}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    {status.touchIdAvailable && (
                        <label className={styles.optionRow}>
                            <span>Unlock with Touch ID</span>
                            <input
                                type="checkbox"
                                checked={status.touchIdEnabled}
                                disabled={isBusy}
                                onChange={event => void run(() => bridge.setTouchId(event.target.checked), false)}
                            />
                        </label>
                    )}
                </>
            )}
        </div>
    );
};

export default WalletSecurityPanel;
