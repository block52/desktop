import { decomposeAmount } from "../../utils/chipBreakdown";
import styles from "./ChipPile.module.css";

const CHIP_IMAGES = import.meta.glob<string>("../../assets/chips/*.svg", { eager: true, query: "?url", import: "default" });

export interface ChipPileProps {
    /** Whole-dollar (or tournament chip) value to draw. */
    amount: number;
    className?: string;
}

/** The web app's chip art, stacked by denomination for the given amount. */
export const ChipPile: React.FC<ChipPileProps> = ({ amount, className }) => (
    <div className={`${styles.pile} ${className ?? ""}`} aria-hidden="true" data-testid="chip-pile">
        {decomposeAmount(amount).map(stack => (
            <div key={stack.file} className={styles.column}>
                {Array.from({ length: stack.visibleCount }, (_, i) => (
                    <img key={i} src={CHIP_IMAGES[`../../assets/chips/${stack.file}.svg`]} className={styles.chip} alt="" draggable={false} />
                ))}
            </div>
        ))}
    </div>
);

export default ChipPile;
