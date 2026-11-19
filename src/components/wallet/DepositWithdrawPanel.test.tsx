// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "@block52/ui-sdk";
import DepositWithdrawPanel, { WalletTab } from "./DepositWithdrawPanel";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import useWalletBalance from "../../hooks/wallet/useWalletBalance";
import useAllowance from "../../hooks/wallet/useAllowance";
import type { EthAccount } from "../../hooks/wallet/useEthAccount";

vi.mock("@reown/appkit/react", () => ({ useAppKit: vi.fn(), useAppKitAccount: vi.fn() }));
vi.mock("../../context/NetworkContext", () => ({
    useNetwork: vi.fn(() => ({ currentNetwork: { name: "t", rpc: "r", rest: "e" } }))
}));
vi.mock("../../hooks/wallet/useDecimals", () => ({ default: vi.fn(() => ({ decimals: 6 })) }));
vi.mock("../../hooks/wallet/useWalletBalance", () => ({ default: vi.fn() }));
vi.mock("../../hooks/wallet/useAllowance", () => ({ default: vi.fn() }));
vi.mock("../../hooks/wallet/useApprove", () => ({
    default: vi.fn(() => ({ approve: vi.fn(), isLoading: false, isApprovePending: false, isApproveConfirmed: false, approveError: null }))
}));
vi.mock("../../hooks/wallet/useDepositUSDC", () => ({
    default: vi.fn(() => ({ deposit: vi.fn(), depositToken: vi.fn(), isPending: false, isDepositPending: false, isDepositConfirmed: false, depositError: null, hash: null }))
}));
vi.mock("wagmi", () => ({
    useWriteContract: vi.fn(() => ({ writeContract: vi.fn(), error: null })),
    useWaitForTransactionReceipt: vi.fn(() => ({ isSuccess: false }))
}));

const mockedUseAppKit = vi.mocked(useAppKit);
const mockedUseAppKitAccount = vi.mocked(useAppKitAccount);
const mockedUseWalletBalance = vi.mocked(useWalletBalance);
const mockedUseAllowance = vi.mocked(useAllowance);

const ETH: EthAccount = {
    available: true,
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    balances: { eth: 10n ** 16n, usdc: 25_500_000n, usdt: 0n, wbtc: 0n },
    isLoading: false,
    error: "",
    refresh: vi.fn(async () => undefined)
};

const BASE = {
    tab: "deposit" as WalletTab,
    cosmosAddress: "b52walletaddress",
    eth: ETH,
    usdcBalanceMicro: "12300000",
    onBalanceRefresh: vi.fn()
};

function renderPanel(overrides: Partial<typeof BASE> = {}) {
    return render(
        <ToastProvider>
            <DepositWithdrawPanel {...BASE} {...overrides} />
        </ToastProvider>
    );
}

/** The external Web3 wallet is the second deposit source now; the Ethereum wallet is the default. */
function openExternalWallet() {
    fireEvent.click(screen.getByRole("tab", { name: "External Web3 wallet" }));
}

function mockWeb3(connected: boolean, address: string | undefined = undefined) {
    mockedUseAppKit.mockReturnValue({ open: vi.fn() } as never);
    mockedUseAppKitAccount.mockReturnValue({ address, isConnected: connected } as never);
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("DepositWithdrawPanel", () => {
    it("opens on the Ethereum wallet: a deposit form from it, with no address or QR code", () => {
        mockWeb3(false);
        mockedUseWalletBalance.mockReturnValue({ balance: 0n } as never);
        mockedUseAllowance.mockReturnValue({ allowance: 0n } as never);
        window.electronAPI = { openExternal: vi.fn(), wallet: { ethDeposit: vi.fn() } as never };
        try {
            renderPanel();
            expect(screen.getByRole("tab", { name: "Ethereum wallet" })).toBeTruthy();
            expect(screen.getByRole("tab", { name: "External Web3 wallet" })).toBeTruthy();
            expect(screen.getByText("From your Ethereum wallet")).toBeTruthy();
            expect(screen.getByRole("button", { name: "Deposit to Block52" })).toBeTruthy();
            expect(screen.queryByText(ETH.address as string)).toBeNull();
        } finally {
            window.electronAPI = undefined;
        }
    });

    it("shows the deposit card with chips, amount, address, and warning note", () => {
        mockWeb3(true, "0xABC");
        mockedUseWalletBalance.mockReturnValue({ balance: 5000000n } as never);
        mockedUseAllowance.mockReturnValue({ allowance: 0n } as never);
        renderPanel();
        openExternalWallet();

        expect(screen.getByText("Deposit")).toBeTruthy();
        expect(screen.getByRole("button", { name: "USDC" }).getAttribute("aria-pressed")).toBe("true");
        expect(screen.getByRole("button", { name: "USDT" }).getAttribute("aria-pressed")).toBe("false");
        expect(screen.getByPlaceholderText("0.00")).toBeTruthy();
        expect(screen.getByText(/Deposits are minted as b52USDC/)).toBeTruthy();
        expect(screen.getByText(/Balance: 5.00 USDC/)).toBeTruthy();
    });

    it("prompts to connect web3 when disconnected", () => {
        mockWeb3(false);
        renderPanel();
        openExternalWallet();
        expect(screen.getByRole("button", { name: "Connect Web3 Wallet" })).toBeTruthy();
    });

    it("MAX fills the deposit amount from the web3 balance", () => {
        mockWeb3(true, "0xABC");
        mockedUseWalletBalance.mockReturnValue({ balance: 5000000n } as never);
        mockedUseAllowance.mockReturnValue({ allowance: 0n } as never);
        renderPanel();
        openExternalWallet();

        fireEvent.click(screen.getByRole("button", { name: "MAX" }));
        expect(screen.getByPlaceholderText("0.00")).toHaveProperty("value", "5");
    });

    it("shows Approve when allowance is zero and Deposit once approved", () => {
        mockWeb3(true, "0xABC");
        mockedUseWalletBalance.mockReturnValue({ balance: 5000000n } as never);
        mockedUseAllowance.mockReturnValue({ allowance: undefined } as never);
        const utils = renderPanel();
        openExternalWallet();

        fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "1" } });
        expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();

        // allowance resolves after mount → approval state flips to Deposit
        mockedUseAllowance.mockReturnValue({ allowance: 5000000n } as never);
        utils.rerender(
            <ToastProvider>
                <DepositWithdrawPanel {...BASE} />
            </ToastProvider>
        );
        expect(screen.getByRole("button", { name: "Deposit" })).toBeTruthy();
    });

    it("shows the withdraw card with amount, to-address, and bridge fee", () => {
        mockWeb3(true, "0x4f2a9C1e7b3D58aE06f1c29B7d4E8a35F0c6b91D");
        renderPanel({ tab: "withdraw" });

        expect(screen.getByText("Amount")).toBeTruthy();
        expect(screen.getByText("To address on Ethereum")).toBeTruthy();
        expect(screen.getByText(/0x4f2a9C1e7b3D58aE06f1c29B7d4E8a35F0c6b91D \(connected wallet\)/)).toBeTruthy();
        expect(screen.getByText("Bridge fee")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Withdraw" })).toBeTruthy();
    });

    it("MAX fills the withdraw amount with the full balance", () => {
        mockWeb3(true, "0xABC");
        renderPanel({ tab: "withdraw" });

        fireEvent.click(screen.getByRole("button", { name: "MAX" }));
        expect(screen.getByPlaceholderText("0.00")).toHaveProperty("value", "12.30");
    });

    it("validates the minimum withdrawal amount", () => {
        mockWeb3(true, "0xABC");
        renderPanel({ tab: "withdraw" });

        fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "0.005" } });
        fireEvent.click(screen.getByRole("button", { name: /Withdraw/ }));
        expect(screen.getByText("Minimum withdrawal is 0.01 USDC")).toBeTruthy();
    });
});
