import React from "react";
import styles from "./LastSession.module.css";

/**
 * No real last-session data source exists yet (Hand history is disabled), so
 * the card renders these placeholder values from the mockup. Replace this
 * constant with a hook once session stats are queryable.
 */
const PLACEHOLDER_LAST_SESSION = {
    net: "+$3.42",
    summary: "38 hands · Table c1001 · 2h ago"
};

const LastSession: React.FC = () => {
    return (
        <div className={`pane-lite ${styles.card}`}>
            <span className="section-label">Your last session</span>
            <div className={styles.stack}>
                <span className={styles.net}>{PLACEHOLDER_LAST_SESSION.net}</span>
                <span className={styles.summary}>{PLACEHOLDER_LAST_SESSION.summary}</span>
            </div>
        </div>
    );
};

export default LastSession;
