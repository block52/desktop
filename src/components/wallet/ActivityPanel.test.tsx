// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ActivityPanel from "./ActivityPanel";
import { useWithdrawalActivity } from "../../hooks/useWithdrawalActivity";
import { useWalletTransfers } from "../../hooks/useWalletTransfers";

vi.mock("../../hooks/useWithdrawalActivity", () => ({
    useWithdrawalActivity: vi.fn()
}));

vi.mock("../../hooks/usePaidOutWithdrawals", () => ({
    usePaidOutWithdrawals: () => new Set<string>()
}));

vi.mock("./CompleteWithdrawalButton", () => ({
    default: () => <button type="button">Complete on Ethereum</button>
}));

vi.mock("../../hooks/useWalletTransfers", () => ({
    useWalletTransfers: vi.fn()
}));

const mockedUseWalletTransfers = vi.mocked(useWalletTransfers);
const mockedUseWithdrawalActivity = vi.mocked(useWithdrawalActivity);

const ITEM = (over: Record<string, unknown> = {}) => ({
    nonce: "abcdef123456",
    toAddress: "0x4f2a9C1e7b3D58aE06f1c29B7d4E8a35F0c6b91D",
    amountMicro: "5000000",
    status: "completed" as const,
    createdAt: 1700000000,
    signature: null as string | null,
    ...over
});

beforeEach(() => {
    mockedUseWalletTransfers.mockReturnValue({ transfers: [], isLoading: false, error: "" });
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("ActivityPanel", () => {
    it("renders a completed withdrawal row", () => {
        mockedUseWithdrawalActivity.mockReturnValue({ items: [ITEM()], isLoading: false, error: "" });
        render(<ActivityPanel address="b52addr" />);

        expect(screen.getByText("Withdrawal")).toBeTruthy();
        expect(screen.getByText("-$5.00")).toBeTruthy();
        expect(screen.getByText("COMPLETED")).toBeTruthy();
        expect(screen.getByText(/To 0x4f2a…/)).toBeTruthy();
    });

    it("lists withdrawals still to complete apart from the history", () => {
        mockedUseWithdrawalActivity.mockReturnValue({
            items: [ITEM({ nonce: "p1", status: "pending", amountMicro: "1000000" }), ITEM({ nonce: "s1", status: "signed", signature: "c2ln" }), ITEM({ nonce: "c1" })],
            isLoading: false,
            error: ""
        });
        render(<ActivityPanel address="b52addr" />);

        expect(screen.getByLabelText("Withdrawals to complete")).toBeTruthy();
        expect(screen.getAllByRole("button", { name: "Complete on Ethereum" })).toHaveLength(2);
        expect(screen.getAllByText("COMPLETED")).toHaveLength(1);
    });

    it("hides the send that pairs with a withdrawal", () => {
        mockedUseWithdrawalActivity.mockReturnValue({ items: [ITEM({ status: "pending", amountMicro: "500000", createdAt: 1700000000 })], isLoading: false, error: "" });
        mockedUseWalletTransfers.mockReturnValue({
            transfers: [
                { hash: "h1", direction: "out", counterparty: "b521lwmodule", amountMicro: "500000", timestamp: 1700000001, success: true },
                { hash: "h2", direction: "out", counterparty: "b521other", amountMicro: "700000", timestamp: 1700000001, success: true }
            ],
            isLoading: false,
            error: ""
        });
        render(<ActivityPanel address="b52addr" />);

        expect(screen.queryByText("-$0.50")).toBeNull();
        expect(screen.getByText("-$0.70")).toBeTruthy();
    });

    it("shows an empty state when there is no activity", () => {
        mockedUseWithdrawalActivity.mockReturnValue({ items: [], isLoading: false, error: "" });
        render(<ActivityPanel address="b52addr" />);
        expect(screen.getByText("No activity yet.")).toBeTruthy();
    });

    it("shows an error state when loading fails", () => {
        mockedUseWithdrawalActivity.mockReturnValue({ items: [], isLoading: false, error: "boom" });
        render(<ActivityPanel address="b52addr" />);
        expect(screen.getByText("boom")).toBeTruthy();
    });

    it("shows a loading spinner on first load", () => {
        mockedUseWithdrawalActivity.mockReturnValue({ items: [], isLoading: true, error: "" });
        render(<ActivityPanel address="b52addr" />);
        expect(screen.getByText("Loading activity…")).toBeTruthy();
    });

    it("renders received transfers alongside withdrawals", () => {
        mockedUseWithdrawalActivity.mockReturnValue({ items: [], isLoading: false, error: "boom" });
        mockedUseWalletTransfers.mockReturnValue({
            transfers: [
                {
                    hash: "H1",
                    direction: "in",
                    counterparty: "b52senderaddress1234",
                    amountMicro: "2500000",
                    timestamp: 1700000000,
                    success: true
                }
            ],
            isLoading: false,
            error: ""
        });
        render(<ActivityPanel address="b52addr" />);

        expect(screen.getByText("Received")).toBeTruthy();
        expect(screen.getByText("+$2.50")).toBeTruthy();
        expect(screen.getByText("CONFIRMED")).toBeTruthy();
        expect(screen.queryByText("boom")).toBeNull();
    });
});
