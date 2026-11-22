// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@block52/ui-sdk";
import type { PlayerProfile as Profile, PlayerSession } from "../../utils/indexer";
import type { PlayerProfileState } from "../../hooks/usePlayerProfile";

const ADDRESS = "b521testplayeraddress0000000000000000000000";

let state: PlayerProfileState;
vi.mock("../../hooks/usePlayerProfile", () => ({ usePlayerProfile: () => state }));
vi.mock("../../components/players/PlayerNotesPanel", () => ({ default: () => null }));

import PlayerProfile from "./PlayerProfile";

const PROFILE: Profile = {
    player_address: ADDRESS,
    total_hands: 1091,
    total_actions: 4630,
    total_buy_ins: 34_100_000,
    total_cash_outs: 8_160_000,
    net_profit: -25_940_000,
    session_count: 20,
    vip_tier: "bronze",
    rakeback_pct: 0,
    vip_points: 0,
    total_rake_contributed: 0,
    vpip: 4264,
    pfr: 1193,
    aggression_factor: 60,
    wtsd: 560,
    won_at_showdown: 3500,
    biggest_pot_won: 12_500_000,
    biggest_hand_profit: 0,
    longest_session_blocks: 1840
};

const SESSION: PlayerSession = {
    player_address: ADDRESS,
    game_id: "0xclosed",
    join_block: 1000,
    leave_block: 1500,
    buy_in_amount: 2_000_000,
    cash_out_amount: 3_000_000,
    created_at: "2026-11-15T09:48:11Z"
};

function renderProfile(profile: Profile, sessions: PlayerSession[] = []) {
    state = { profile, sessions, sessionsTotal: sessions.length, isLoading: false, error: "" };
    render(
        <ToastProvider>
            <MemoryRouter>
                <PlayerProfile address={ADDRESS} />
            </MemoryRouter>
        </ToastProvider>
    );
}

/** The value and note shown in the stat tile with this label. */
function tile(label: string): string {
    const tileEl = screen.getByText(label, { selector: ".section-label" }).parentElement;
    if (tileEl === null) throw new Error(`no tile ${label}`);
    return tileEl.textContent;
}

afterEach(cleanup);

describe("PlayerProfile tiles", () => {
    it("shows the indexer's style stats and records", () => {
        renderProfile(PROFILE);
        expect(tile("VPIP")).toContain("42.6%");
        expect(tile("PFR")).toContain("11.9%");
        expect(tile("WTSD")).toContain("5.6%");
        expect(tile("Biggest pot")).toContain("$12.50");
        expect(tile("Sessions")).toContain("Longest 1,840 blocks");
    });

    it("shows — for a biggest pot of 0 (none recorded, or Sit & Go only) instead of $0.00", () => {
        renderProfile({ ...PROFILE, biggest_pot_won: 0 });
        expect(tile("Biggest pot")).toContain("—");
        expect(tile("Biggest pot")).not.toContain("$0.00");
    });

    it("says there is no finished session instead of Longest 0 blocks", () => {
        renderProfile({ ...PROFILE, longest_session_blocks: 0 });
        expect(tile("Sessions")).toContain("No finished sessions");
        expect(tile("Sessions")).not.toContain("0 blocks");
    });

    it("shows — for the percentages of a player with no hands", () => {
        renderProfile({ ...PROFILE, total_hands: 0, vpip: 0, pfr: 0, wtsd: 0 });
        for (const label of ["VPIP", "PFR", "WTSD"]) {
            expect(tile(label)).toContain("—");
            expect(tile(label)).not.toContain("0.0%");
        }
    });

    it("keeps a real 0% for a player with hands", () => {
        renderProfile({ ...PROFILE, pfr: 0 });
        expect(tile("PFR")).toContain("0.0%");
    });
});

describe("PlayerProfile session history", () => {
    it("shows a closed session's leave block and cash-out", () => {
        renderProfile(PROFILE, [SESSION]);
        const row = screen.getByText("0xclosed").parentElement;
        if (row === null) throw new Error("no row");
        expect(within(row).getByText("1,500")).toBeTruthy();
        expect(within(row).getByText("$3.00")).toBeTruthy();
    });

    it("shows — for an open session's leave block and cash-out (the indexer omits both)", () => {
        const open: PlayerSession = { ...SESSION, game_id: "0xopen", leave_block: undefined, cash_out_amount: undefined };
        renderProfile(PROFILE, [open]);
        const row = screen.getByText("0xopen").parentElement;
        if (row === null) throw new Error("no row");
        expect(within(row).getAllByText("—")).toHaveLength(2);
        expect(within(row).queryByText("$0.00")).toBeNull();
    });
});
