// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@block52/ui-sdk";
import type { EthAccount } from "../../hooks/wallet/useEthAccount";
import type { WalletBridge } from "../../wallet/types";
import EthDepositPanel from "./EthDepositPanel";

const ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

function account(overrides: Partial<EthAccount> = {}): EthAccount {
    return {
        available: true,
        address: ADDRESS,
        balances: { eth: 10n ** 16n, usdc: 25_500_000n, usdt: 3_000_000n, wbtc: 12_345_678n },
        isLoading: false,
        error: "",
        refresh: vi.fn(async () => undefined),
        ...overrides
    };
}

function install(overrides: Partial<WalletBridge> = {}) {
    const bridge = { ethDeposit: vi.fn(async () => ({ approveHash: "0xa", depositHash: "0xd" })), ...overrides } as unknown as WalletBridge;
    window.electronAPI = { openExternal: vi.fn(), wallet: bridge };
    return bridge;
}

function renderPanel(eth: EthAccount = account(), onCompleted = vi.fn()) {
    render(
        <ToastProvider>
            <EthDepositPanel eth={eth} onCompleted={onCompleted} />
        </ToastProvider>
    );
    return onCompleted;
}

afterEach(() => {
    cleanup();
    window.electronAPI = undefined;
});

describe("EthDepositPanel", () => {
    it("is only the transfer: token choice with balances, amount and the button, no address or asset list", () => {
        install();
        renderPanel();
        expect(screen.getByText("From your Ethereum wallet")).toBeTruthy();
        expect(screen.getByRole("radio", { name: /USDC.*25\.5/ })).toBeTruthy();
        expect(screen.getByRole("radio", { name: /USDT.*3/ })).toBeTruthy();
        expect(screen.queryByText(ADDRESS)).toBeNull();
        expect(screen.queryByText("wBTC")).toBeNull();
        expect(screen.queryByText("Refresh")).toBeNull();
    });

    it("deposits the typed amount, then refreshes both wallets", async () => {
        const bridge = install();
        const eth = account();
        const onCompleted = renderPanel(eth);
        fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "10" } });
        fireEvent.click(screen.getByText("Deposit to Block52"));
        await waitFor(() => expect(bridge.ethDeposit).toHaveBeenCalledWith("USDC", 10_000_000n));
        await waitFor(() => expect(onCompleted).toHaveBeenCalledOnce());
        expect(eth.refresh).toHaveBeenCalled();
        expect(await screen.findByText(/Sent\./)).toBeTruthy();
    });

    it("MAX fills the whole balance of the chosen token, and switching token clears it", () => {
        install();
        renderPanel();
        fireEvent.click(screen.getByText("MAX"));
        expect((screen.getByPlaceholderText("0.00") as HTMLInputElement).value).toBe("25.5");
        fireEvent.click(screen.getByRole("radio", { name: /USDT/ }));
        expect((screen.getByPlaceholderText("0.00") as HTMLInputElement).value).toBe("");
        fireEvent.click(screen.getByText("MAX"));
        expect((screen.getByPlaceholderText("0.00") as HTMLInputElement).value).toBe("3");
    });

    it("will not send more than the wallet holds", () => {
        const bridge = install();
        renderPanel();
        fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "30" } });
        expect((screen.getByText("Deposit to Block52") as HTMLButtonElement).disabled).toBe(true);
        expect(bridge.ethDeposit).not.toHaveBeenCalled();
    });

    it("shows why a deposit was refused, without Electron's IPC prefix", async () => {
        install({ ethDeposit: vi.fn(async () => Promise.reject(new Error("Error invoking remote method 'wallet:eth-deposit': Error: Cancelled."))) });
        renderPanel();
        fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "1" } });
        fireEvent.click(screen.getByText("Deposit to Block52"));
        expect(await screen.findByText("Cancelled.")).toBeTruthy();
    });

    it("shows the wallet's own read error", () => {
        install();
        renderPanel(account({ balances: null, error: "The Ethereum node did not answer." }));
        expect(screen.getByText("The Ethereum node did not answer.")).toBeTruthy();
    });

    it("says it needs the desktop app when there is no bridge", () => {
        renderPanel(account({ available: false }));
        expect(screen.getByText(/available in the desktop app/)).toBeTruthy();
    });
});
