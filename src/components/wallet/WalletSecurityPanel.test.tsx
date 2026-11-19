// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { WalletBridge, WalletStatus } from "../../wallet/types";
import WalletSecurityPanel from "./WalletSecurityPanel";

const STATUS: WalletStatus = {
    exists: true,
    locked: false,
    hasPassword: false,
    touchIdEnabled: false,
    touchIdAvailable: false,
    pgpAvailable: true,
    pgpFingerprint: null,
    autoLockMinutes: 15,
    osProtected: true,
};

function renderPanel(status: Partial<WalletStatus> = {}, overrides: Partial<WalletBridge> = {}, raw?: object) {
    const bridge = {
        status: vi.fn(async () => raw ?? { ...STATUS, ...status }),
        setPgpKey: vi.fn(async () => undefined),
        removePgpKey: vi.fn(async () => undefined),
        lock: vi.fn(async () => undefined),
        ...overrides,
    } as unknown as WalletBridge;
    render(<WalletSecurityPanel bridge={bridge} />);
    return bridge;
}

afterEach(cleanup);

describe("WalletSecurityPanel", () => {
    it("offers to add a PGP key when gpg is installed", async () => {
        renderPanel();
        expect(await screen.findByText("Add PGP key")).toBeTruthy();
    });

    it("explains that gpg is missing instead of offering a PGP key", async () => {
        renderPanel({ pgpAvailable: false });
        expect(await screen.findByText(/Install GnuPG/)).toBeTruthy();
        expect(screen.queryByText("Add PGP key")).toBeNull();
    });

    it("sends the pasted public key", async () => {
        const bridge = renderPanel();
        fireEvent.click(await screen.findByText("Add PGP key"));
        fireEvent.change(screen.getByPlaceholderText(/BEGIN PGP PUBLIC KEY BLOCK/), { target: { value: "-----BEGIN PGP PUBLIC KEY BLOCK-----\nabc" } });
        fireEvent.click(screen.getByText("Save PGP key"));
        await waitFor(() => expect(bridge.setPgpKey).toHaveBeenCalledWith("-----BEGIN PGP PUBLIC KEY BLOCK-----\nabc"));
    });

    it("shows the key in use, and that it is the only way in without a password", async () => {
        renderPanel({ pgpFingerprint: "ABCD".repeat(10) });
        expect(await screen.findByText(/ABCD ABCD ABCD/)).toBeTruthy();
        expect(screen.getByText(/the only way in/)).toBeTruthy();
        expect(screen.getByText("Remove PGP key")).toBeTruthy();
    });

    it("says the password works as well when there is one", async () => {
        renderPanel({ pgpFingerprint: "ABCD".repeat(10), hasPassword: true });
        expect(await screen.findByText(/as well as the password/)).toBeTruthy();
    });

    it("does not crash when the main process sends a status without the PGP fields", async () => {
        // An older main process (a dev run that was not restarted) answers without the new fields.
        const { pgpFingerprint: _fingerprint, pgpAvailable: _available, ...stale } = STATUS;
        renderPanel({}, {}, stale);
        expect(await screen.findByText("Security")).toBeTruthy();
    });
});
