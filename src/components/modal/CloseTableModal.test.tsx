// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CloseTableModal } from "./CloseTableModal";

afterEach(cleanup);

describe("CloseTableModal", () => {
    it("warns about refunds when closing a table with players", () => {
        const onConfirm = vi.fn();
        render(<CloseTableModal mode="force-close" tableName="Table 0x1" seatedPlayers={2} isSubmitting={false} onConfirm={onConfirm} onClose={() => undefined} />);
        expect(screen.getByText(/All 2 players will be removed/)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Close table" }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("offers a plain delete for an empty table", () => {
        render(<CloseTableModal mode="delete" tableName="Table 0x1" seatedPlayers={0} isSubmitting={false} onConfirm={() => undefined} onClose={() => undefined} />);
        expect(screen.getByRole("button", { name: "Delete table" })).toBeTruthy();
    });

    it("locks the buttons while the transaction is sent", () => {
        render(<CloseTableModal mode="delete" tableName="Table 0x1" seatedPlayers={0} isSubmitting onConfirm={() => undefined} onClose={() => undefined} />);
        expect((screen.getByRole("button", { name: "Working…" }) as HTMLButtonElement).disabled).toBe(true);
    });
});
