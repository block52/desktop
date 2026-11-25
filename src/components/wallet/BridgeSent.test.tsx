// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ToastProvider } from "@block52/ui-sdk";
import BridgeSent from "./BridgeSent";

const heights: { first: number | null; latest: number | null } = { first: null, latest: null };
vi.mock("../../hooks/useBlockHeight", () => ({ useBlockHeight: () => ({ ...heights }) }));
vi.mock("../../hooks/useAvgBlockTime", () => ({ useAvgBlockTime: () => ({ avgBlockTimeSeconds: 6, isLoading: false }) }));

const DEPOSIT = `0x${"d".repeat(64)}`;
const APPROVE = `0x${"a".repeat(64)}`;

function show(approveHash: string | null = null) {
    return render(
        <ToastProvider>
            <BridgeSent approveHash={approveHash} depositHash={DEPOSIT} />
        </ToastProvider>
    );
}

afterEach(() => {
    cleanup();
    heights.first = null;
    heights.latest = null;
});

describe("BridgeSent", () => {
    it("shows the deposit transaction with a copy button, and no bar until the height is known", () => {
        show();
        expect(screen.getByText("Deposit")).toBeTruthy();
        expect(screen.getByText(/Tx: 0xdddddddd/)).toBeTruthy();
        expect(screen.getByRole("button", { name: "Copy deposit transaction hash" })).toBeTruthy();
        expect(screen.queryByRole("progressbar")).toBeNull();
        expect(screen.queryByText("Approval")).toBeNull();
    });

    it("also shows the approval when there was one", () => {
        show(APPROVE);
        expect(screen.getByText("Approval")).toBeTruthy();
        expect(screen.getByText(/Tx: 0xaaaaaaaa/)).toBeTruthy();
    });

    it("counts blocks and percent toward the next 50-block sync", () => {
        heights.first = 1_236_230;
        heights.latest = 1_236_230;
        const view = show();
        expect(screen.getByText("Minting in 20 blocks (about 2 min)")).toBeTruthy();
        expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
        expect(screen.getByText(/block 1,236,250/)).toBeTruthy();

        heights.latest = 1_236_240;
        view.rerender(
            <ToastProvider>
                <BridgeSent approveHash={null} depositHash={DEPOSIT} />
            </ToastProvider>
        );
        expect(screen.getByText("Minting in 10 blocks (about 1 min)")).toBeTruthy();
        expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
    });

    it("says the sync block was reached once the chain gets there", () => {
        heights.first = 1_236_230;
        heights.latest = 1_236_230;
        const view = show();
        heights.latest = 1_236_251;
        view.rerender(
            <ToastProvider>
                <BridgeSent approveHash={null} depositHash={DEPOSIT} />
            </ToastProvider>
        );
        expect(screen.getByText("Sync block reached. Your balance should update shortly.")).toBeTruthy();
        expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
    });
});
