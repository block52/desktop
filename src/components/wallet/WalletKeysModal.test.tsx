// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../context/ToastContext";
import WalletKeysModal from "./WalletKeysModal";
import { setCosmosMnemonic } from "../../utils/cosmos/storage";

const MNEMONIC = "alpha bravo charlie delta echo foxtrot golf hotel india juliett kilo lima";

function renderModal(onCleared = vi.fn()) {
    return render(
        <MemoryRouter>
            <ToastProvider>
                <WalletKeysModal address="b52walletaddress" onClose={vi.fn()} onCleared={onCleared} />
            </ToastProvider>
        </MemoryRouter>
    );
}

afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
});

describe("WalletKeysModal", () => {
    it("renders the address and hides the seed phrase by default", () => {
        setCosmosMnemonic(MNEMONIC);
        renderModal();

        expect(screen.getByDisplayValue("b52walletaddress")).toBeTruthy();
        expect(screen.getAllByText("••••").length).toBe(12);
        expect(screen.queryByText("alpha")).toBeNull();
    });

    it("reveals the seed words when Show is clicked", () => {
        setCosmosMnemonic(MNEMONIC);
        renderModal();

        fireEvent.click(screen.getByRole("button", { name: "Show" }));
        expect(screen.getByText("alpha")).toBeTruthy();
        expect(screen.getByText("lima")).toBeTruthy();
    });

    it("calls onCleared when the wallet is cleared and confirmed", async () => {
        setCosmosMnemonic(MNEMONIC);
        const onCleared = vi.fn();
        vi.spyOn(window, "confirm").mockReturnValue(true);
        renderModal(onCleared);

        fireEvent.click(screen.getByRole("button", { name: "Clear Wallet" }));
        await waitFor(() => expect(onCleared).toHaveBeenCalledTimes(1));
    });

    it("calls onClose when the close button is clicked", () => {
        setCosmosMnemonic(MNEMONIC);
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
