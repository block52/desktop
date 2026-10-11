import React, { useEffect, useState } from "react";
import { formatCountdown, formatLocalLabel, formatUtcLabel, type UpcomingSng } from "../../utils/sngSchedule";
import styles from "./FeaturedTable.module.css";

interface UpcomingSngSlideProps {
    sng: UpcomingSng;
}

function openLink(url: string): void {
    if (window.electronAPI !== undefined) {
        window.electronAPI.openExternal(url);
    } else {
        window.open(url, "_blank", "noopener,noreferrer");
    }
}

/** A scheduled (not yet created) Sit & Go: when it starts, a live countdown, and where to register. */
const UpcomingSngSlide: React.FC<UpcomingSngSlideProps> = ({ sng }) => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={styles.hero}>
            <div className={styles.tableEllipse} />

            <div className={styles.badges}>
                <span className={styles.badgeSng}>SIT &amp; GO</span>
                <span className={styles.badgeStatus}>Scheduled</span>
            </div>

            <div className={styles.textBlock}>
                <div className={styles.heroTitle}>{sng.name}</div>
                <div className={styles.heroDescription}>
                    {formatUtcLabel(sng.nextStart)} · your time {formatLocalLabel(sng.nextStart)}
                </div>
            </div>

            <div className={styles.footer}>
                <button className={`btn-glow shimmer-hover ${styles.registerButton}`} onClick={() => openLink(sng.link)}>
                    Register · {sng.buyIn}
                </button>
                <div className={styles.metaStack}>
                    <span className={`section-label ${styles.metaLabel}`}>Starts in</span>
                    <span className={styles.metaValue}>{formatCountdown(sng.nextStart.getTime() - now)}</span>
                </div>
                <div className={styles.metaStack}>
                    <span className={`section-label ${styles.metaLabel}`}>Buy-in</span>
                    <span className={styles.prizeValue}>{sng.buyIn}</span>
                </div>
            </div>
        </div>
    );
};

export default UpcomingSngSlide;
