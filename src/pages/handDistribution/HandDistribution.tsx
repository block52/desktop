import React, { useState } from "react";
import EquityCalculator from "./EquityCalculator";
import FairnessAudit from "./FairnessAudit";
import styles from "./HandDistribution.module.css";

type Tab = "fairness" | "equity";

const SUBTITLES: Record<Tab, string> = {
    fairness: "How often each card has been dealt across on-chain hands. A fair shuffle keeps every bar near the line.",
    equity: "Monte Carlo equity for any matchup, computed by the chain — same engine that settles all-ins.",
};

const HandDistribution: React.FC = () => {
    const [tab, setTab] = useState<Tab>("fairness");

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>Hand distribution</h1>
                <p className={styles.subtitle}>{SUBTITLES[tab]}</p>
            </div>

            <div className="segmented" role="tablist" style={{ alignSelf: "flex-start" }}>
                <button type="button" role="tab" aria-selected={tab === "fairness"} className={tab === "fairness" ? "seg on" : "seg"} onClick={() => setTab("fairness")}>
                    Fairness audit
                </button>
                <button type="button" role="tab" aria-selected={tab === "equity"} className={tab === "equity" ? "seg on" : "seg"} onClick={() => setTab("equity")}>
                    Equity calculator
                </button>
            </div>

            {tab === "fairness" ? <FairnessAudit /> : <EquityCalculator />}
        </div>
    );
};

export default HandDistribution;
