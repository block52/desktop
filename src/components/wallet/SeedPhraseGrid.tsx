import styles from "./SeedPhraseGrid.module.css";

interface SeedPhraseGridProps {
    mnemonic: string;
    hidden?: boolean;
}

const SeedPhraseGrid: React.FC<SeedPhraseGridProps> = ({ mnemonic, hidden = false }) => {
    const words = mnemonic.split(" ");
    return (
        <div className={styles.seedGrid}>
            {words.map((word, index) => (
                <div key={index} className={styles.seedWord}>
                    <span className={styles.seedIndex}>{index + 1}.</span>
                    <span className={styles.seedText}>{hidden ? "••••" : word}</span>
                </div>
            ))}
        </div>
    );
};

export default SeedPhraseGrid;
