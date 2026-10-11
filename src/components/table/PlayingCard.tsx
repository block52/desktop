import styles from "./PlayingCard.module.css";

export type Suit = "S" | "H" | "D" | "C";

export interface ParsedCard {
    rank: string;
    suit: Suit;
}

export const SUIT_SYMBOLS: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

const SYMBOL_TO_SUIT: Record<string, Suit> = { "♠": "S", "♥": "H", "♦": "D", "♣": "C" };
const VALID_RANKS = new Set(["A", "K", "Q", "J", "T", "10", "9", "8", "7", "6", "5", "4", "3", "2"]);

/** Parse "AS", "A♠", "th", or "10d" into rank + suit. Null when unrecognised. */
export function parseCard(code: string): ParsedCard | null {
    const trimmed = code.trim();
    if (trimmed === "") return null;

    let rank: string;
    let suitChar: string;
    if (trimmed.length === 2) {
        rank = trimmed[0].toUpperCase();
        suitChar = trimmed[1];
    } else if (trimmed.length === 3 && trimmed.slice(0, 2).toUpperCase() === "10") {
        rank = "10";
        suitChar = trimmed[2];
    } else {
        return null;
    }

    if (!VALID_RANKS.has(rank)) return null;

    let suit: Suit | undefined = SYMBOL_TO_SUIT[suitChar];
    if (suit === undefined) {
        const upper = suitChar.toUpperCase();
        if (upper === "S" || upper === "H" || upper === "D" || upper === "C") {
            suit = upper;
        }
    }
    if (suit === undefined) return null;

    return { rank: rank === "T" ? "10" : rank, suit };
}

interface PlayingCardProps {
    code: string;
    faceDown?: boolean;
    className?: string;
}

const RED_SUITS = new Set<Suit>(["H", "D"]);

const PlayingCard: React.FC<PlayingCardProps> = ({ code, faceDown = false, className }) => {
    if (faceDown) {
        return (
            <svg viewBox="0 0 60 84" className={`${styles.card} ${className ?? ""}`} data-testid="card-back" aria-label="Face-down card">
                <rect x="1" y="1" width="58" height="82" rx="7" fill="#241a3f" stroke="hsl(263 50% 30%)" strokeWidth="1.5" />
                <rect x="6" y="6" width="48" height="72" rx="5" fill="none" stroke="hsl(263 60% 45% / 0.5)" strokeWidth="1" strokeDasharray="4 3" />
                <text x="30" y="50" textAnchor="middle" fontSize="26" fill="hsl(263 80% 75% / 0.7)">52</text>
            </svg>
        );
    }

    const parsed = parseCard(code);
    if (parsed === null) return null;

    const color = RED_SUITS.has(parsed.suit) ? "#c2334b" : "#1d2b3f";
    const symbol = SUIT_SYMBOLS[parsed.suit];
    const corner = parsed.rank === "10" ? "10" : parsed.rank;

    return (
        <svg viewBox="0 0 60 84" className={`${styles.card} ${className ?? ""}`} aria-label={`${corner} of ${parsed.suit}`}>
            <rect x="1" y="1" width="58" height="82" rx="7" fill="#f6f3ec" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
            <text x="9" y="21" fontSize="17" fontWeight="700" fill={color} fontFamily="Inter, system-ui, sans-serif">
                {corner}
            </text>
            <text x="9" y="36" fontSize="14" fill={color}>
                {symbol}
            </text>
            <text x="34" y="62" fontSize="30" fill={color}>
                {symbol}
            </text>
        </svg>
    );
};

export default PlayingCard;
