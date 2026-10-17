import React, { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import styles from "./Tooltip.module.css";

interface TooltipProps {
    content: React.ReactNode;
    /** A larger hover card for richer content, such as a link preview. */
    card?: boolean;
    children: React.ReactNode;
}

/** Shows `content` above the wrapped control while it is hovered or focused. */
const Tooltip: React.FC<TooltipProps> = ({ content, card, children }) => {
    const [open, setOpen] = useState(false);

    return (
        <MotionConfig reducedMotion="user">
            <span className={styles.wrap} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
                {children}
                <AnimatePresence>
                    {open && (
                        <motion.span
                            role="tooltip"
                            className={card === true ? `${styles.tip} ${styles.card}` : styles.tip}
                            initial={{ opacity: 0, y: 6, scale: 0.94 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.96 }}
                            transition={{ type: "spring", stiffness: 420, damping: 28 }}
                        >
                            {content}
                        </motion.span>
                    )}
                </AnimatePresence>
            </span>
        </MotionConfig>
    );
};

export default Tooltip;
