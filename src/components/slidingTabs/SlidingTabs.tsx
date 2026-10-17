import { useId } from "react";
import { MotionConfig, motion } from "motion/react";
import styles from "./SlidingTabs.module.css";

interface SlidingTabsOption<T extends string> {
    value: T;
    label: string;
    /** Shown in a small badge after the label. */
    count?: number;
}

interface SlidingTabsProps<T extends string> {
    options: SlidingTabsOption<T>[];
    value: T;
    onChange: (value: T) => void;
    label: string;
    /** Stretch the options to share the full width. */
    fill?: boolean;
}

/** A segmented switch whose highlight slides to the chosen option. */
function SlidingTabs<T extends string>({ options, value, onChange, label, fill }: SlidingTabsProps<T>) {
    const pillId = useId();

    return (
        <MotionConfig reducedMotion="user">
            <div className={fill === true ? `segmented ${styles.tabs} ${styles.fill}` : `segmented ${styles.tabs}`} role="tablist" aria-label={label}>
                {options.map(option => (
                    <button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={option.value === value}
                        className={option.value === value ? `${styles.tab} ${styles.on}` : styles.tab}
                        onClick={() => onChange(option.value)}
                    >
                        {option.value === value && (
                            <motion.span layoutId={pillId} className={styles.pill} transition={{ type: "spring", bounce: 0.25, duration: 0.45 }} />
                        )}
                        <span className={styles.text}>{option.label}</span>
                        {option.count !== undefined && <span className={`seg-count ${styles.text}`}>{option.count}</span>}
                    </button>
                ))}
            </div>
        </MotionConfig>
    );
}

export default SlidingTabs;
