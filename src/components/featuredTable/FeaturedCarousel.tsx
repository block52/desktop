import React, { useMemo, useState } from "react";
import type { GameWithFormat } from "../../hooks/useFindGames";
import { useSngSchedule } from "../../hooks/useSngSchedule";
import { getUpcomingSngs } from "../../utils/sngSchedule";
import FeaturedTable from "./FeaturedTable";
import UpcomingSngSlide from "./UpcomingSngSlide";
import styles from "./FeaturedCarousel.module.css";

/** Scheduled tournaments shown after the live featured table. */
const UPCOMING_COUNT = 2;

interface FeaturedCarouselProps {
    /** The live Sit & Go chosen as the featured table, when there is one. */
    game: GameWithFormat | null | undefined;
}

type Slide = { kind: "live"; game: GameWithFormat } | { kind: "upcoming"; id: string };

/**
 * The dashboard hero: the live featured Sit & Go first, then the next scheduled tournaments, as a slider
 * with arrows and dots. A single slide renders without controls.
 */
const FeaturedCarousel: React.FC<FeaturedCarouselProps> = ({ game }) => {
    const { tournaments } = useSngSchedule();
    const upcoming = useMemo(() => {
        if (tournaments.length === 0) return [];
        try {
            return getUpcomingSngs(tournaments, new Date(), UPCOMING_COUNT);
        } catch {
            return [];
        }
    }, [tournaments]);

    const slides: Slide[] = [
        ...(game !== null && game !== undefined ? [{ kind: "live", game } as const] : []),
        ...upcoming.map(sng => ({ kind: "upcoming", id: sng.id }) as const)
    ];

    const [requested, setRequested] = useState(0);
    if (slides.length === 0) return null;

    const index = Math.min(requested, slides.length - 1);
    const slide = slides[index];
    const go = (delta: number) => setRequested((index + delta + slides.length) % slides.length);

    const current =
        slide.kind === "live" ? (
            <FeaturedTable game={slide.game} />
        ) : (
            (() => {
                const sng = upcoming.find(candidate => candidate.id === slide.id);
                return sng !== undefined ? <UpcomingSngSlide sng={sng} /> : null;
            })()
        );

    return (
        <div className={styles.carousel}>
            {current}
            {slides.length > 1 && (
                <div className={styles.controls}>
                    <button type="button" className={styles.arrow} onClick={() => go(-1)} aria-label="Previous">
                        ‹
                    </button>
                    <div className={styles.dots} role="tablist" aria-label="Featured tournaments">
                        {slides.map((slide, position) => (
                            <button
                                key={slide.kind === "live" ? "live" : slide.id}
                                type="button"
                                role="tab"
                                aria-selected={position === index}
                                aria-label={`Slide ${position + 1} of ${slides.length}`}
                                className={`${styles.dot} ${position === index ? styles.dotOn : ""}`}
                                onClick={() => setRequested(position)}
                            />
                        ))}
                    </div>
                    <button type="button" className={styles.arrow} onClick={() => go(1)} aria-label="Next">
                        ›
                    </button>
                </div>
            )}
        </div>
    );
};

export default FeaturedCarousel;
