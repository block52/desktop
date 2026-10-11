import { PlayerStatus } from "@block52/poker-vm-sdk";
import { formatMicroUsd } from "./currency";
import type { PlayerHand } from "./indexer";

export type HandOutcomeTone = "won" | "lost" | "neutral";

export interface HandOutcome {
    label: string;
    tone: HandOutcomeTone;
}

/**
 * What happened to the wallet in a hand. `isChips` is the table's unit
 * (true = Sit & Go / tournament chips, false = micro-USDC, undefined = not
 * known yet — the amount then shows without units).
 */
export function describeHandOutcome(hand: Pick<PlayerHand, "status" | "won_amount" | "estimated">, isChips: boolean | undefined): HandOutcome {
    // Matched from the wallet's table sessions: it was seated for the hand, but the result is not known.
    if (hand.estimated === true) {
        return { label: "Played", tone: "neutral" };
    }
    if (hand.won_amount > 0) {
        const amount = isChips === false ? formatMicroUsd(hand.won_amount) : hand.won_amount.toLocaleString();
        return { label: `Won ${amount}${isChips === true ? " chips" : ""}`, tone: "won" };
    }
    switch (hand.status) {
        case PlayerStatus.FOLDED:
            return { label: "Folded", tone: "neutral" };
        case PlayerStatus.BUSTED:
            return { label: "Busted", tone: "lost" };
        case "":
            return { label: "Left the table", tone: "neutral" };
        default:
            return { label: "Lost", tone: "lost" };
    }
}
