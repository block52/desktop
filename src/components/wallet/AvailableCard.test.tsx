// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AvailableCard from "./AvailableCard";
import type { WalletTab } from "./DepositWithdrawPanel";

const BASE_PROPS = {
    usdcBalanceMicro: "12300000",
    pendingWithdrawalMicro: "5000000",
    address: "b52abc123def",
    web3Address: null as string | null,
    isWeb3Connected: false,
    tab: "deposit" as WalletTab,
    onTabChange: vi.fn(),
    onSend: vi.fn(),
    onManageWeb3: vi.fn(),
    onShowKeys: vi.fn(),
    onRefresh: vi.fn(),
    isRefreshing: false
};

function renderCard(overrides: Partial<typeof BASE_PROPS> = {}) {
    const props = { ...BASE_PROPS, ...overrides };
    render(<AvailableCard {...props} />);
    return props;
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("AvailableCard", () => {
    it("renders the balance formatted as dollars", () => {
        renderCard();
        expect(screen.getByText("$12.30")).toBeTruthy();
    });

    it("renders the pending withdrawal amount", () => {
        renderCard();
        expect(screen.getByText("Pending withdrawal")).toBeTruthy();
        expect(screen.getByText("-$5.00")).toBeTruthy();
    });

    it("shows the short b52 address in the card header", () => {
        renderCard();
        expect(screen.getByText("b52…3def")).toBeTruthy();
    });

    it("fires onTabChange with deposit when the Deposit segment is clicked", () => {
        const props = renderCard();
        fireEvent.click(screen.getByRole("button", { name: "Deposit" }));
        expect(props.onTabChange).toHaveBeenCalledWith("deposit");
    });

    it("fires onTabChange with withdraw when the Withdraw segment is clicked", () => {
        const props = renderCard();
        fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
        expect(props.onTabChange).toHaveBeenCalledWith("withdraw");
    });

    it("fires onShowKeys when the wallet keys icon is clicked", () => {
        const props = renderCard();
        fireEvent.click(screen.getByRole("button", { name: "Wallet keys" }));
        expect(props.onShowKeys).toHaveBeenCalledTimes(1);
    });

    it("fires onRefresh when the refresh icon is clicked", () => {
        const props = renderCard();
        fireEvent.click(screen.getByRole("button", { name: "Refresh balance and activity" }));
        expect(props.onRefresh).toHaveBeenCalledTimes(1);
    });

    it("disables the refresh icon while refreshing", () => {
        renderCard({ isRefreshing: true });
        const button = screen.getByRole("button", { name: "Refresh balance and activity" }) as HTMLButtonElement;
        expect(button.disabled).toBe(true);
    });

    it("hides the web3 row when disconnected", () => {
        renderCard();
        expect(screen.queryByText("Web3 wallet not connected")).toBeNull();
        expect(screen.queryByRole("button", { name: "Connect Web3 Wallet" })).toBeNull();
    });

    it("shows the web3 address and Manage action when connected", () => {
        const props = renderCard({ isWeb3Connected: true, web3Address: "0x4f2a9C1e7b3D58aE06f1c29B7d4E8a35F0c6b91D" });
        expect(screen.getByText("0x4f2a…b91D")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Manage" }));
        expect(props.onManageWeb3).toHaveBeenCalledTimes(1);
    });
});
