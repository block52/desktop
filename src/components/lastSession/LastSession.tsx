import React from "react";
import { useLastSession } from "../../hooks/useLastSession";
import { getCosmosAddress } from "../../utils/cosmos/storage";
import styles from "./LastSession.module.css";

const LastSession: React.FC = () => {
    const address = getCosmosAddress();
    const { session, isLoading, error } = useLastSession(address);

    const netClass = session?.tone === "won" ? styles.netWon : session?.tone === "lost" ? styles.netLost : "";
    const summary =
        address === null
            ? "Create or import a wallet to see your sessions"
            : isLoading
              ? "Loading…"
              : error !== ""
                ? "Couldn't load your sessions"
                : session === null
                  ? "No sessions yet — sit at a table"
                  : session.summary;

    return (
        <div className={`pane-lite ${styles.card}`}>
            <span className="section-label">Your last session</span>
            <div className={styles.stack}>
                <span className={`${styles.net} ${netClass}`}>{session !== null ? session.net : "—"}</span>
                <span className={styles.summary}>{summary}</span>
            </div>
        </div>
    );
};

export default LastSession;
