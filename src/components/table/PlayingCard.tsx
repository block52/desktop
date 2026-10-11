import React from "react";
import styles from "./PlayingCard.module.css";

// Card faces and the back are the web app's art (ui/src/assets/cards), keyed by file name: "AS", "TD", "b52CardBack".
const CARD_IMAGES = import.meta.glob<string>("../../assets/cards/*.svg", { eager: true, query: "?url", import: "default" });

function cardImageUrl(name: string): string {
    return CARD_IMAGES[`../../assets/cards/${name}.svg`];
}

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
    style?: React.CSSProperties;
}

const SUIT_NAMES: Record<Suit, string> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };

const PlayingCard: React.FC<PlayingCardProps> = ({ code, faceDown = false, className, style }) => {
    if (faceDown) {
        return (
            <img
                src={cardImageUrl("b52CardBack")}
                className={`${styles.card} ${className ?? ""}`}
                style={style}
                data-testid="card-back"
                alt="Face-down card"
                draggable={false}
            />
        );
    }

    const parsed = parseCard(code);
    if (parsed === null) return null;

    const file = `${parsed.rank === "10" ? "T" : parsed.rank}${parsed.suit}`;
    return (
        <img
            src={cardImageUrl(file)}
            className={`${styles.card} ${className ?? ""}`}
            style={style}
            alt={`${parsed.rank} of ${SUIT_NAMES[parsed.suit]}`}
            draggable={false}
        />
    );
};

export default PlayingCard;
