// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AvailableCard from "./AvailableCard";
import { ToastProvider } from "@block52/ui-sdk";
import type { EthAccount } from "../../hooks/wallet/useEthAccount";
import type { WalletTab } from "./DepositWithdrawPanel";

const ETH_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

function ethAccount(overrides: Partial<EthAccount> = {}): EthAccount {
    return {
        available: true,
        address: ETH_ADDRESS,
        balances: { eth: 0n, usdc: 25_500_000n, usdt: 0n, wbtc: 0n },
        isLoading: false,
        error: "",
        refresh: vi.fn(async () => undefined),
        ...overrides
    };
}

const BASE_PROPS = {
    usdcBalanceMicro: "12300000",
    address: "b52abc123def",
    eth: ethAccount(),
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
    render(
        <ToastProvider>
            <AvailableCard {...props} />
        </ToastProvider>
    );
    return props;
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("AvailableCard", () => {
    it("is titled like the Deposit card, not a small label", () => {
        renderCard();
        expect(screen.getByRole("heading", { name: "Available" })).toBeTruthy();
    });

    it("shows both wallets' USDC", () => {
        renderCard();
        expect(screen.getByText("Block52 USDC")).toBeTruthy();
        expect(screen.getByText("$12.30")).toBeTruthy();
        expect(screen.getByText("Ethereum USDC")).toBeTruthy();
        expect(screen.getByText("$25.50")).toBeTruthy();
    });

    it("cuts balances to cents instead of rounding up", () => {
        renderCard({ usdcBalanceMicro: "12349999" });
        expect(screen.getByText("$12.34")).toBeTruthy();
    });

    it("says what else the Ethereum wallet holds, only when there is something", () => {
        renderCard({ eth: ethAccount({ balances: { eth: 20_000_000_000_000_000n, usdc: 0n, usdt: 10_000_000n, wbtc: 0n } }) });
        expect(screen.getByText("also holds 0.02 ETH · 10 USDT")).toBeTruthy();
        cleanup();
        renderCard();
        expect(screen.queryByText(/also holds/)).toBeNull();
    });

    it("shows a placeholder while the Ethereum balance loads and a dash when it fails", () => {
        renderCard({ eth: ethAccount({ balances: null, isLoading: true }) });
        expect(screen.getByText("…")).toBeTruthy();
        cleanup();
        renderCard({ eth: ethAccount({ balances: null, error: "node down" }) });
        expect(screen.getByText("—")).toBeTruthy();
    });

    it("leaves out the Ethereum wallet outside the desktop app", () => {
        renderCard({ eth: ethAccount({ available: false, address: null, balances: null }) });
        expect(screen.queryByText("Ethereum USDC")).toBeNull();
        expect(screen.queryByText("Ethereum address")).toBeNull();
    });

    it("shows both addresses once, in full, each in a box with its own copy button", () => {
        renderCard();
        expect(screen.getAllByText("b52abc123def")).toHaveLength(1);
        expect(screen.getAllByText(ETH_ADDRESS)).toHaveLength(1);
        expect(screen.getByRole("button", { name: "Copy Block52 address" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Copy Ethereum address" })).toBeTruthy();
    });

    it("has no QR code any more", () => {
        renderCard();
        expect(screen.queryByText("Receive")).toBeNull();
        expect(document.querySelector("svg path[fill='#000000'], canvas")).toBeNull();
    });

    it("fires onTabChange for Deposit and Withdraw", () => {
        const props = renderCard();
        fireEvent.click(screen.getByRole("tab", { name: "Withdraw" }));
        fireEvent.click(screen.getByRole("tab", { name: "Deposit" }));
        expect(props.onTabChange).toHaveBeenNthCalledWith(1, "withdraw");
        expect(props.onTabChange).toHaveBeenNthCalledWith(2, "deposit");
    });

    it("fires onShowKeys from the gear and onRefresh from the refresh icon, and disables refresh while it runs", () => {
        const props = renderCard();
        fireEvent.click(screen.getByRole("button", { name: "Wallet keys" }));
        fireEvent.click(screen.getByRole("button", { name: "Refresh balances and activity" }));
        expect(props.onShowKeys).toHaveBeenCalledTimes(1);
        expect(props.onRefresh).toHaveBeenCalledTimes(1);
        cleanup();
        renderCard({ isRefreshing: true });
        expect((screen.getByRole("button", { name: "Refresh balances and activity" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("hides the external wallet row when none is connected", () => {
        renderCard();
        expect(screen.queryByText("External Web3 wallet")).toBeNull();
    });

    it("shows the connected external wallet with its Manage action", () => {
        const props = renderCard({ isWeb3Connected: true, web3Address: "0x4f2a9C1e7b3D58aE06f1c29B7d4E8a35F0c6b91D" });
        expect(screen.getByText("External Web3 wallet")).toBeTruthy();
        expect(screen.getByText(/0x4f2a9C1e7b3D58aE06f1c29B7d4E8a35F0c6b91D/)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Manage wallet" }));
        expect(props.onManageWeb3).toHaveBeenCalledTimes(1);
    });
});
