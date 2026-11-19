// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@block52/ui-sdk";
import type { EthBalances, WalletBridge } from "../../wallet/types";
import EthDepositPanel from "./EthDepositPanel";

const ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const BALANCES: EthBalances = { eth: 10n ** 16n, usdc: 25_500_000n, usdt: 0n, wbtc: 12_345_678n };

function install(overrides: Partial<WalletBridge> = {}) {
    const bridge = {
        ethAddress: vi.fn(async () => ADDRESS),
        ethBalances: vi.fn(async () => BALANCES),
        ethDeposit: vi.fn(async () => ({ approveHash: "0xa", depositHash: "0xd" })),
        ...overrides,
    } as unknown as WalletBridge;
    window.electronAPI = { openExternal: vi.fn(), wallet: bridge };
    return bridge;
}

function renderPanel(onCompleted = vi.fn()) {
    render(
        <ToastProvider>
            <EthDepositPanel onCompleted={onCompleted} />
        </ToastProvider>
    );
    return onCompleted;
}

afterEach(() => {
    cleanup();
    window.electronAPI = undefined;
});

describe("EthDepositPanel", () => {
    it("shows the derived address in full and what is held on it, with wBTC not BTC", async () => {
        install();
        renderPanel();
        expect(await screen.findByText(ADDRESS)).toBeTruthy();
        expect(await screen.findByText("25.5")).toBeTruthy();
        expect(screen.getByText("0.12345678")).toBeTruthy();
        expect(screen.getByText("wBTC")).toBeTruthy();
        expect(screen.queryByText("BTC")).toBeNull();
    });

    it("deposits the typed amount and refreshes the Block52 balance", async () => {
        const bridge = install();
        const onCompleted = renderPanel();
        await screen.findByText("25.5");
        fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "10" } });
        fireEvent.click(screen.getByText("Deposit to Block52"));
        await waitFor(() => expect(bridge.ethDeposit).toHaveBeenCalledWith("USDC", 10_000_000n));
        await waitFor(() => expect(onCompleted).toHaveBeenCalledOnce());
        expect(await screen.findByText(/Sent\./)).toBeTruthy();
    });

    it("MAX fills the whole balance of the chosen token", async () => {
        install();
        renderPanel();
        await screen.findByText("25.5");
        fireEvent.click(screen.getByText("MAX"));
        expect((screen.getByPlaceholderText("0.00") as HTMLInputElement).value).toBe("25.5");
    });

    it("will not send more than the address holds", async () => {
        const bridge = install();
        renderPanel();
        await screen.findByText("25.5");
        fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "30" } });
        expect((screen.getByText("Deposit to Block52") as HTMLButtonElement).disabled).toBe(true);
        expect(bridge.ethDeposit).not.toHaveBeenCalled();
    });

    it("shows the reason when a deposit is refused", async () => {
        install({ ethDeposit: vi.fn(async () => Promise.reject(new Error("Cancelled."))) });
        renderPanel();
        await screen.findByText("25.5");
        fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "1" } });
        fireEvent.click(screen.getByText("Deposit to Block52"));
        expect(await screen.findByText("Cancelled.")).toBeTruthy();
    });

    it("says it needs the desktop app when there is no bridge", () => {
        window.electronAPI = undefined;
        renderPanel();
        expect(screen.getByText(/available in the desktop app/)).toBeTruthy();
    });
});
