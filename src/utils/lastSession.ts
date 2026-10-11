import type { PlayerSession } from "./indexer";
import { formatMicroUsd } from "./currency";

export interface LastSessionSummary {
    /** "+$0.36" / "-$0.04", or "In play" while the player is still seated. */
    net: string;
    tone: "won" | "lost" | "neutral";
    /** "Table 0x684c…c169 · 2h ago". */
    summary: string;
}

function ago(isoTime: string, nowMs: number): string {
    const seconds = Math.max(0, Math.round((nowMs - new Date(isoTime).getTime()) / 1000));
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

const shortTable = (id: string): string => `${id.slice(0, 6)}…${id.slice(-4)}`;

/** The wallet's most recent table session, as the dashboard card shows it. `handCount` is null when unknown. */
export function summariseSession(session: PlayerSession, handCount: number | null, nowMs: number): LastSessionSummary {
    const parts: string[] = [];
    if (handCount !== null) parts.push(`${handCount} ${handCount === 1 ? "hand" : "hands"}`);
    parts.push(`Table ${shortTable(session.game_id)}`);
    parts.push(ago(session.created_at, nowMs));
    const summary = parts.join(" · ");

    if (session.cash_out_amount === undefined || session.leave_block === undefined) {
        return { net: "In play", tone: "neutral", summary };
    }
    const net = session.cash_out_amount - session.buy_in_amount;
    const sign = net > 0 ? "+" : "";
    return { net: `${sign}${formatMicroUsd(net)}`, tone: net > 0 ? "won" : net < 0 ? "lost" : "neutral", summary };
}
