import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { WalletStatus } from "../../wallet/types";
import { closeWalletSession, openWalletSession, unlockWalletSession } from "../../utils/cosmos/walletSession";
import styles from "./WalletLockGate.module.css";

interface WalletLockGateProps {
    children: ReactNode;
}

const ACTIVITY_REPORT_MS = 15_000;

const LockScreen: React.FC<{ status: WalletStatus; onUnlocked: () => void }> = ({ status, onUnlocked }) => {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const canUseTouchId = status.touchIdEnabled && status.touchIdAvailable;

    const attempt = useCallback(
        async (credential: { password: string } | { touchId: true }) => {
            setIsBusy(true);
            setError("");
            try {
                if (await unlockWalletSession(credential)) {
                    onUnlocked();
                    return;
                }
                setError("password" in credential ? "Wrong password." : "Touch ID did not unlock the wallet.");
            } catch (err) {
                setError(err instanceof Error ? err.message : "Could not unlock the wallet.");
            } finally {
                setIsBusy(false);
            }
        },
        [onUnlocked]
    );

    // Offer Touch ID straight away, the way the OS does.
    useEffect(() => {
        if (canUseTouchId) void Promise.resolve().then(() => attempt({ touchId: true }));
        // Only on first show.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (password !== "") void attempt({ password });
    };

    return (
        <div className={styles.screen}>
            <form className={styles.card} onSubmit={submit}>
                <h1 className={styles.title}>Wallet locked</h1>
                <p className={styles.hint}>Enter your password to unlock Block52.</p>
                <input
                    className={styles.input}
                    type="password"
                    placeholder="Password"
                    autoFocus
                    autoComplete="current-password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    disabled={isBusy}
                />
                {error !== "" && <p className={styles.error}>{error}</p>}
                <div className={styles.actions}>
                    <button type="submit" className="btn-glow" disabled={isBusy || password === ""}>
                        Unlock
                    </button>
                    {canUseTouchId && (
                        <button type="button" className="btn-ghost" disabled={isBusy} onClick={() => void attempt({ touchId: true })}>
                            Use Touch ID
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
};

/** Keeps the app behind the lock screen while the wallet is locked, and loads the seed into memory once it opens. */
const WalletLockGate: React.FC<WalletLockGateProps> = ({ children }) => {
    const [status, setStatus] = useState<WalletStatus | null>(null);
    const [isReady, setIsReady] = useState(false);
    const bridge = window.electronAPI?.wallet;

    useEffect(() => {
        let cancelled = false;
        void openWalletSession().then(opened => {
            if (cancelled) return;
            setStatus(opened);
            setIsReady(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (bridge === undefined) return;
        return bridge.onLocked(() => {
            closeWalletSession();
            void bridge.status().then(setStatus);
        });
    }, [bridge]);

    useEffect(() => {
        if (bridge === undefined) return;
        let last = 0;
        const report = () => {
            const now = Date.now();
            if (now - last < ACTIVITY_REPORT_MS) return;
            last = now;
            bridge.reportActivity();
        };
        window.addEventListener("pointerdown", report);
        window.addEventListener("keydown", report);
        return () => {
            window.removeEventListener("pointerdown", report);
            window.removeEventListener("keydown", report);
        };
    }, [bridge]);

    const handleUnlocked = useCallback(() => {
        if (bridge !== undefined) void bridge.status().then(setStatus);
    }, [bridge]);

    if (!isReady) return null;
    if (status !== null && status.exists && status.locked) return <LockScreen status={status} onUnlocked={handleUnlocked} />;
    return <>{children}</>;
};

export default WalletLockGate;
