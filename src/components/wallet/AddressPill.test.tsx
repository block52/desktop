// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@block52/ui-sdk";
import AddressPill from "./AddressPill";

const ADDRESS = "b5215yk64u7zc9g9k2yr2wmzeva5qgwxps6ykmt6fw";

afterEach(cleanup);

describe("AddressPill", () => {
    it("shows the whole address with the copy button inside the same box", () => {
        render(
            <ToastProvider>
                <AddressPill address={ADDRESS} />
            </ToastProvider>
        );
        const box = screen.getByText(ADDRESS).parentElement as HTMLElement;
        expect(box.contains(screen.getByRole("button", { name: "Copy address" }))).toBe(true);
    });

    it("copies the full address", async () => {
        const writeText = vi.fn(async () => undefined);
        Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
        render(
            <ToastProvider>
                <AddressPill address={ADDRESS} copyTitle="Copy Ethereum address" copyMessage="Ethereum address copied" />
            </ToastProvider>
        );
        fireEvent.click(screen.getByRole("button", { name: "Copy Ethereum address" }));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(ADDRESS));
    });
});
