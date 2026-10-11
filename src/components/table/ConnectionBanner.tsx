import React from "react";
import { RECONNECT_MAX_ATTEMPTS, type ConnectionState } from "../../context/GameStateContext";
import styles from "./ConnectionBanner.module.css";

interface ConnectionBannerProps {
    connection: ConnectionState;
    onRetry: () => void;
}

/**
 * Shown whenever the live feed is not fresh. The table underneath is the last snapshot received, and
 * actions are paused until a new one arrives, so the player must know it may be out of date.
 */
export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ connection, onRetry }) => {
    if (connection.status === "live" || connection.status === "idle") return null;

    const isOffline = connection.status === "offline";
    const message =
        connection.status === "connecting"
            ? "Connecting to the table…"
            : isOffline
              ? "Connection lost. The table may be out of date and actions are paused."
              : `Connection lost — reconnecting (attempt ${connection.attempt} of ${RECONNECT_MAX_ATTEMPTS}). Actions are paused.`;

    return (
        <div className={`${styles.banner} ${isOffline ? styles.offline : ""}`} role="status" aria-live="polite" data-testid="connection-banner">
            <span>{message}</span>
            {isOffline && (
                <button type="button" className={styles.retry} onClick={onRetry}>
                    Retry now
                </button>
            )}
        </div>
    );
};

export default ConnectionBanner;
