import type { TournamentOptionsDTO, TournamentStateDTO, TournamentStatus } from "@block52/poker-vm-sdk";
import { microToDecimal } from "./currency";

const TOURNAMENT_ID = /^(0x[0-9a-fA-F]{64})(?:-t\d+)?$/;

/** The tournament a pasted id points at: its own id, or one of its tables (`<id>-t3`). Null for anything else. */
export function tournamentIdOf(raw: string): string | null {
    const match = TOURNAMENT_ID.exec(raw.trim());
    return match === null ? null : match[1].toLowerCase();
}

interface RawEvent {
    type?: string;
    attributes?: { key?: string; value?: string }[];
}

interface RawTx {
    tx_result?: { events?: RawEvent[] };
}

/** The ids in `tournament_created` events of a CometBFT tx_search result, in the order given, without repeats. */
export function createdTournamentIds(txs: RawTx[]): string[] {
    const ids: string[] = [];
    for (const tx of txs) {
        for (const event of tx.tx_result?.events ?? []) {
            if (event.type !== "tournament_created") continue;
            const id = event.attributes?.find(attribute => attribute.key === "tournament_id")?.value;
            if (id !== undefined && tournamentIdOf(id) !== null && !ids.includes(id)) ids.push(id);
        }
    }
    return ids;
}

const STATUS_LABELS: Record<TournamentStatus, string> = {
    registering: "Registering",
    running: "Running",
    finished: "Finished",
    cancelled: "Cancelled"
};

export function tournamentStatusLabel(status: TournamentStatus): string {
    return STATUS_LABELS[status];
}

/** Chain amounts are micro-USDC strings; an empty or malformed one reads as 0. */
export function usdc(micro: string | undefined): string {
    if (micro === undefined || !/^\d+$/.test(micro)) return "0";
    return microToDecimal(BigInt(micro));
}

/** What registering costs in total: the buy-in plus the entry fee (the protocol cut is taken out of the buy-in). */
export function totalCost(options: TournamentOptionsDTO): string {
    const buyIn = /^\d+$/.test(options.buyIn) ? BigInt(options.buyIn) : 0n;
    const fee = options.entryFee !== undefined && /^\d+$/.test(options.entryFee) ? BigInt(options.entryFee) : 0n;
    return microToDecimal(buyIn + fee);
}

/** Entrants that still hold a seat in the field (registered or playing; not unregistered). */
export function entrantCount(tournament: TournamentStateDTO): number {
    return tournament.entrants.filter(entrant => entrant.status !== "unregistered").length;
}

export function isRegistered(tournament: TournamentStateDTO, address: string | null): boolean {
    if (address === null) return false;
    const mine = address.toLowerCase();
    return tournament.entrants.some(entrant => entrant.address.toLowerCase() === mine && entrant.status !== "unregistered");
}

/** The start time, as the SDK gives it in milliseconds, in the viewer's locale. */
export function startLabel(startTime: number): string {
    return startTime > 0 ? new Date(startTime).toLocaleString() : "When the field is full";
}

/** Newest-created first is the order the lookup returns; within that, live tournaments float above finished ones. */
export function sortTournaments(list: TournamentStateDTO[]): TournamentStateDTO[] {
    const rank: Record<TournamentStatus, number> = { running: 0, registering: 1, finished: 2, cancelled: 3 };
    return list.map((tournament, index) => ({ tournament, index })).sort((a, b) => rank[a.tournament.status] - rank[b.tournament.status] || a.index - b.index).map(entry => entry.tournament);
}

export interface BlindLine {
    key: string;
    label: string;
    text: string;
}

/** What to show for a blind structure: the listed levels, or one line for a preset or a formula. */
export function blindLines(options: TournamentOptionsDTO): BlindLine[] {
    const structure = options.blindStructure;
    if ("levels" in structure) {
        return structure.levels.map(level => ({
            key: String(level.level),
            label: level.isBreak ? "Break" : `Level ${level.level + 1}`,
            text: `${level.isBreak ? "" : `${level.smallBlind} / ${level.bigBlind}${level.ante !== "0" ? ` ante ${level.ante}` : ""} · `}${level.durationMinutes} min`
        }));
    }
    if ("preset" in structure) return [{ key: "preset", label: "Preset", text: structure.preset.replace(/_/g, " ") }];
    return [{ key: "start", label: "Start", text: `${structure.startSmallBlind} / ${structure.startBigBlind} · ${structure.durationMinutes} min a level` }];
}

export interface TimeLeft {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
    done: boolean;
}

/** The time from `nowMs` to `startMs`, split for a countdown. Past or unset start times read as done. */
export function timeLeft(startMs: number, nowMs: number): TimeLeft {
    const totalSeconds = Math.max(0, Math.ceil((startMs - nowMs) / 1000));
    return {
        days: Math.floor(totalSeconds / 86_400),
        hours: Math.floor((totalSeconds % 86_400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
        totalSeconds,
        done: totalSeconds === 0
    };
}

/** How the countdown should feel: calm until the last hour, then building, then the final minute and the last ten seconds. */
export type Urgency = "calm" | "soon" | "minute" | "final";

export function urgencyOf(totalSeconds: number): Urgency {
    if (totalSeconds <= 10) return "final";
    if (totalSeconds <= 60) return "minute";
    if (totalSeconds <= 3600) return "soon";
    return "calm";
}
