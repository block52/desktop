import React from "react";
import { useUpdateNotice } from "../../hooks/useUpdateNotice";
import styles from "./UpdateBanner.module.css";

/** A slim notice when a newer release exists. It only links to the release page; nothing is downloaded or run by the app. */
const UpdateBanner: React.FC = () => {
    const { update, download, dismiss } = useUpdateNotice();
    if (update === null) return null;

    return (
        <div className={`pane-lite ${styles.banner}`} role="status">
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.text}>
                <span className={styles.title}>Version {update.version} is available</span>
                <span className={styles.detail}>Download it from the release page and replace the app in Applications.</span>
            </span>
            <button type="button" className={`btn-glow ${styles.action}`} onClick={download}>
                Download
            </button>
            <button type="button" className={`btn-ghost ${styles.action}`} onClick={dismiss}>
                Later
            </button>
        </div>
    );
};

export default UpdateBanner;
