// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ToastProvider } from "@block52/ui-sdk";
import type { BridgeRow } from "../../utils/bridgeHistory";
import BridgeHistory from "./BridgeHistory";

const HASH = `0x${"d".repeat(64)}`;
const state: { rows: BridgeRow[]; isLoading: boolean; error: string } = { rows: [], isLoading: false, error: "" };

vi.mock("../../hooks/useBridgeHistory", () => ({ useBridgeHistory: () => ({ ...state }) }));

function row(overrides: Partial<BridgeRow>): BridgeRow {
    return { key: "k", status: "minted", amount: "5000000", token: "USDC", time: 1_795_600_000_000, txHash: HASH, mintHeight: 1_236_300, reason: null, ...overrides };
}

function show() {
    return render(
        <ToastProvider>
            <BridgeHistory address="b521me" />
        </ToastProvider>
    );
}

beforeEach(() => {
    state.rows = [];
    state.isLoading = false;
    state.error = "";
});
afterEach(cleanup);

describe("BridgeHistory", () => {
    it("shows a minted deposit with its whole tx hash, amount and mint block", () => {
        state.rows = [row({})];
        show();
        expect(screen.getByText("MINTED")).toBeTruthy();
        expect(screen.getByText(`Tx: ${HASH}`)).toBeTruthy();
        expect(screen.getByText("+$5")).toBeTruthy();
        expect(screen.getByText(/minted at block 1,236,300/)).toBeTruthy();
        expect(screen.getByText("Bridge USDC")).toBeTruthy();
    });

    it("shows a deposit that has not minted yet as sent", () => {
        state.rows = [row({ status: "sent", mintHeight: null })];
        show();
        expect(screen.getByText("SENT")).toBeTruthy();
        expect(screen.queryByText(/minted at block/)).toBeNull();
    });

    it("explains a mint with no recorded transaction, and a skipped one with its reason", () => {
        state.rows = [row({ key: "a", txHash: null, token: null, mintHeight: 50 }), row({ key: "b", status: "skipped", txHash: null, token: null, reason: "below the minimum" })];
        show();
        expect(screen.getAllByText(/Sent from another app or machine/)).toHaveLength(2);
        expect(screen.getByText("SKIPPED")).toBeTruthy();
        expect(screen.getByText(/below the minimum/)).toBeTruthy();
    });

    it("says when there is nothing, while loading, and when it failed", () => {
        show();
        expect(screen.getByText("No bridge deposits yet.")).toBeTruthy();
        cleanup();
        state.isLoading = true;
        show();
        expect(screen.getByText("Loading bridge history…")).toBeTruthy();
        cleanup();
        state.isLoading = false;
        state.error = "HTTP 502";
        show();
        expect(screen.getByText("HTTP 502")).toBeTruthy();
    });
});
