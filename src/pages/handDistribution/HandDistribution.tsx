import React, { useState } from "react";
import EquityCalculator from "./EquityCalculator";
import FairnessAudit from "./FairnessAudit";
import SlidingTabs from "../../components/slidingTabs/SlidingTabs";
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

            <div style={{ alignSelf: "flex-start" }}>
                <SlidingTabs
                    label="Hand distribution view"
                    options={[
                        { value: "fairness", label: "Fairness audit" },
                        { value: "equity", label: "Equity calculator" }
                    ]}
                    value={tab}
                    onChange={setTab}
                />
            </div>

            {tab === "fairness" ? <FairnessAudit /> : <EquityCalculator />}
        </div>
    );
};

export default HandDistribution;
