import React, { useState, useEffect, useCallback, useRef } from "react";
import styles from "./AppBackground.module.css";

const AppBackground: React.FC = () => {
    const [mouse, setMouse] = useState({ x: 50, y: 50 });
    const rafRef = useRef<number | undefined>(undefined);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
            const x = Math.round((e.clientX / window.innerWidth)  * 100);
            const y = Math.round((e.clientY / window.innerHeight) * 100);
            setMouse(prev =>
                Math.abs(prev.x - x) > 2 || Math.abs(prev.y - y) > 2
                    ? { x, y }
                    : prev
            );
            rafRef.current = undefined;
        });
    }, []);

    useEffect(() => {
        window.addEventListener("mousemove", handleMouseMove);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [handleMouseMove]);

    return (
        <div className={styles.root} aria-hidden="true">
            {/* Base colour */}
            <div className={styles.base} />

            {/* Floating orbs — pure CSS animation */}
            <div className={styles.orb1} />
            <div className={styles.orb2} />
            <div className={styles.orb3} />

            {/* Mouse-tracking spotlight */}
            <div
                className={styles.spotlight}
                style={{
                    background: `radial-gradient(ellipse 40% 35% at ${mouse.x}% ${mouse.y}%, rgba(99,102,241,0.10) 0%, transparent 70%)`
                }}
            />

            {/* Hexagon grid */}
            <div className={styles.hexGrid}>
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="hex" width="56" height="48.5" patternUnits="userSpaceOnUse">
                            <path
                                d="M28,3 L52,16 L52,43 L28,56 L4,43 L4,16 Z"
                                fill="none"
                                stroke="rgba(99,102,241,0.18)"
                                strokeWidth="0.6"
                            />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#hex)" />
                </svg>
            </div>

            {/* Shimmer scanline */}
            <div className={styles.shimmer} />
        </div>
    );
};

export default AppBackground;
