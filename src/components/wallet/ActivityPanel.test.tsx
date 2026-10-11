// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ActivityPanel from "./ActivityPanel";
import { useWithdrawalActivity } from "../../hooks/useWithdrawalActivity";

vi.mock("../../hooks/useWithdrawalActivity", () => ({
    useWithdrawalActivity: vi.fn()
}));

const mockedUseWithdrawalActivity = vi.mocked(useWithdrawalActivity);

const ITEM = (over: Record<string, unknown> = {}) => ({
    nonce: "abcdef123456",
    toAddress: "0x4f2a9C1e7b3D58aE06f1c29B7d4E8a35F0c6b91D",
    amountMicro: "5000000",
    status: "completed" as const,
    createdAt: 1700000000,
    ...over
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

    it("renders PENDING and READY pills for the other statuses", () => {
        mockedUseWithdrawalActivity.mockReturnValue({
            items: [ITEM({ nonce: "p1", status: "pending" }), ITEM({ nonce: "s1", status: "signed" })],
            isLoading: false,
            error: ""
        });
        render(<ActivityPanel address="b52addr" />);

        expect(screen.getByText("PENDING")).toBeTruthy();
        expect(screen.getByText("READY")).toBeTruthy();
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
});
