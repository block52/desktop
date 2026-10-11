/**
 * Seat positioning for the table felt — table size, seat coordinates, and
 * the "hero always at the bottom" rotation. Ported from ui's real
 * src/config/stageGeometry.ts (SEAT_COORDS, converted from absolute stage
 * pixels to percentages of each table size's own bounding box) and its
 * Table.tsx rotation formula (seatNumber = ((uiPosition + startIndex) %
 * tableSize) + 1) — algebraically inverted here into a direct seat→position
 * lookup, since a renderer iterating its own players list needs "where does
 * this server seat render" rather than ui's "which server seat is at this
 * render position."
 *
 * Deliberately does NOT port ui's SEAT_SPREAD/COMPONENT_SCALE/chip-distance/
 * dealer-distance tuning, viewport zoom/fit, or mobile rotation — none of
 * that applies to this simpler, non-choreographed, fixed-window-class
 * design. Only the seat coordinates and the rotation formula are real,
 * reusable logic; everything else in ui's stageGeometry.ts is visual
 * tuning for a different rendering approach.
 */

export type TableSize = 2 | 4 | 6 | 9;

/**
 * Pick the smallest supported table size that fits maxPlayers. There is no
 * supported layout for, say, a 3-max or 5-max table — round up to the
 * nearest size this module has coordinates for.
 */
export function resolveTableSize(maxPlayers: number): TableSize {
    if (maxPlayers <= 2) return 2;
    if (maxPlayers <= 4) return 4;
    if (maxPlayers <= 6) return 6;
    return 9;
}

/**
 * Raw seat coordinates as percentages of each table size's own bounding
 * box (0-100 range), before the vertical-safe-zone compression below.
 * Converted from ui's stageGeometry.ts SEAT_COORDS (absolute 1600x850
 * stage pixels) by normalizing each table size's own coordinate set
 * against its own min/max — NOT ui's SEAT_SPREAD-adjusted values.
 */
const SEAT_PERCENT_RAW: Record<TableSize, Array<{ left: number; top: number }>> = {
    2: [
        { left: 50, top: 100 },
        { left: 50, top: 0 },
    ],
    4: [
        { left: 50, top: 100 },
        { left: 0, top: 50 },
        { left: 50, top: 0 },
        { left: 100, top: 50 },
    ],
    6: [
        { left: 50, top: 100 },
        { left: 0, top: 75 },
        { left: 0, top: 25 },
        { left: 50, top: 0 },
        { left: 100, top: 25 },
        { left: 100, top: 75 },
    ],
    9: [
        { left: 50, top: 100 },
        { left: 27.7, top: 98.3 },
        { left: 0, top: 66.0 },
        { left: 8.75, top: 11.5 },
        { left: 38.1, top: 0 },
        { left: 61.9, top: 0 },
        { left: 91.25, top: 11.5 },
        { left: 100, top: 66.0 },
        { left: 72.3, top: 98.3 },
    ],
};

// Compresses the raw [0,100] vertical range into [14,78]. The felt spans
// 12%–80% of the seat plane (see TableBoard's .feltBox), so the top seat
// sits 2% inside its edge and the bottom seat 2% inside the opposite one —
// seats hug the rail evenly instead of the bottom seat floating below it,
// and side seats land on the felt's vertical centre (46%).
const SAFE_TOP_MIN = 14;
const SAFE_TOP_MAX = 58;

// A seat is its avatar plus a nameplate and hole cards hanging below/around it, so the
// avatar's anchor sits well inside the rail: bottom-row seats are raised so their cards
// land on the felt, and side seats are pulled in so their cards do not overhang the rail.
const SAFE_LEFT_MIN = 8;
const SAFE_LEFT_MAX = 92;

function compressLeft(rawLeft: number): number {
    return SAFE_LEFT_MIN + (rawLeft / 100) * (SAFE_LEFT_MAX - SAFE_LEFT_MIN);
}

function compressTop(rawTop: number): number {
    return SAFE_TOP_MIN + (rawTop / 100) * (SAFE_TOP_MAX - SAFE_TOP_MIN);
}

/**
 * Final left/top percentages for a seat at the given UI position (0-indexed,
 * 0 = hero/bottom-center) on a table of the given size.
 *
 * For the 9-max layout specifically: ui's own source coordinates give the
 * hero seat (index 0) a top of 100 while its two bottom-row neighbors
 * (indices 1 and 8) sit at 98.3 — a subtle, intentional 10px offset in
 * ui's own larger, more complex rendering context. At this design's
 * smaller scale that offset reads as a misalignment bug, not a deliberate
 * choice (confirmed directly by the user during visual review) — so this
 * function forces all three bottom-row seats to the same raw top (98.3)
 * before compression, rather than trusting ui's source data as-is.
 */
export function getSeatPercent(tableSize: TableSize, uiPosition: number): { left: number; top: number } {
    const raw = SEAT_PERCENT_RAW[tableSize][uiPosition];
    const rawTop = tableSize === 9 && (uiPosition === 0 || uiPosition === 1 || uiPosition === 8) ? 98.3 : raw.top;
    return { left: compressLeft(raw.left), top: compressTop(rawTop) };
}

/**
 * Which UI position (0-indexed, 0 = bottom-center) a player at the given
 * real server seat should render at, given the local hero's own real
 * server seat — so the hero always renders at position 0 regardless of
 * their actual assigned seat number.
 *
 * Ported from ui's Table.tsx rotation: `seatNumber = ((uiPosition +
 * startIndex) % tableSize) + 1`, where `startIndex` is set so the hero's
 * own seat maps to uiPosition 0. Solving that forward formula for
 * `startIndex` gives `startIndex = heroServerSeat - 1`; substituting back
 * and inverting for uiPosition (given a server seat, not given a UI
 * position) yields the direct lookup below — the same rotation, expressed
 * for the direction this renderer actually needs.
 */
export function seatToUiPosition(serverSeat: number, heroServerSeat: number, tableSize: TableSize): number {
    return ((serverSeat - heroServerSeat) % tableSize + tableSize) % tableSize;
}
