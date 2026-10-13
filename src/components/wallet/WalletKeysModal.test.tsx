// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../context/ToastContext";
import type { WalletBridge, WalletStatus } from "../../wallet/types";
import WalletKeysModal from "./WalletKeysModal";

const MNEMONIC = "alpha bravo charlie delta echo foxtrot golf hotel india juliett kilo lima";

const STATUS: WalletStatus = {
    exists: true,
    locked: false,
    hasPassword: false,
    touchIdEnabled: false,
    touchIdAvailable: false,
    autoLockMinutes: 15,
    osProtected: true,
};

function installBridge(overrides: Partial<WalletBridge> = {}, status: Partial<WalletStatus> = {}) {
    const bridge = {
        status: vi.fn(async () => ({ ...STATUS, ...status })),
        revealMnemonic: vi.fn(async () => MNEMONIC),
        authenticate: vi.fn(async () => true),
        clear: vi.fn(async () => undefined),
        resetSigner: vi.fn(async () => undefined),
        ...overrides,
    } as unknown as WalletBridge;
    window.electronAPI = { openExternal: vi.fn(), wallet: bridge };
    return bridge;
}

function renderModal(onCleared = vi.fn()) {
    return render(
        <MemoryRouter>
            <ToastProvider>
                <WalletKeysModal address="b52walletaddress" onClose={vi.fn()} onCleared={onCleared} />
            </ToastProvider>
        </MemoryRouter>
    );
}

beforeEach(() => {
    window.electronAPI = undefined;
});

afterEach(() => {
    cleanup();
    localStorage.clear();
    window.electronAPI = undefined;
    vi.restoreAllMocks();
});

describe("WalletKeysModal", () => {
    it("renders the address and does not ask the wallet for the seed phrase until Show is clicked", async () => {
        const bridge = installBridge();
        renderModal();

        expect(screen.getByDisplayValue("b52walletaddress")).toBeTruthy();
        expect(screen.queryByText("alpha")).toBeNull();
        expect(bridge.revealMnemonic).not.toHaveBeenCalled();
    });

    it("reveals the seed words when Show is clicked", async () => {
        installBridge();
        renderModal();

        fireEvent.click(screen.getByRole("button", { name: "Show" }));
        expect(await screen.findByText("alpha")).toBeTruthy();
        expect(screen.getByText("lima")).toBeTruthy();
    });

    it("hides the seed words again on Hide", async () => {
        installBridge();
        renderModal();

        fireEvent.click(screen.getByRole("button", { name: "Show" }));
        await screen.findByText("alpha");
        fireEvent.click(screen.getByRole("button", { name: "Hide" }));
        expect(screen.queryByText("alpha")).toBeNull();
    });

    it("asks for the password before revealing when one is set", async () => {
        const bridge = installBridge({}, { hasPassword: true });
        renderModal();
        await waitFor(() => expect(bridge.status).toHaveBeenCalled());

        fireEvent.click(screen.getByRole("button", { name: "Show" }));
        expect(await screen.findByPlaceholderText("Password")).toBeTruthy();
        expect(bridge.revealMnemonic).not.toHaveBeenCalled();

        fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "correct horse" } });
        fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
        expect(await screen.findByText("alpha")).toBeTruthy();
        expect(bridge.authenticate).toHaveBeenCalledWith({ password: "correct horse" });
    });

    it("calls onCleared when the wallet is cleared and confirmed", async () => {
        const bridge = installBridge();
        const onCleared = vi.fn();
        vi.spyOn(window, "confirm").mockReturnValue(true);
        renderModal(onCleared);

        fireEvent.click(screen.getByRole("button", { name: "Clear Wallet" }));
        await waitFor(() => expect(onCleared).toHaveBeenCalledTimes(1));
        expect(bridge.clear).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when the close button is clicked", () => {
        const onClose = vi.fn();
        render(
            <MemoryRouter>
                <ToastProvider>
                    <WalletKeysModal address="b52walletaddress" onClose={onClose} onCleared={vi.fn()} />
                </ToastProvider>
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
