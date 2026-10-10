// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "../../context/ToastContext";
import AccountsColumn from "./AccountsColumn";
import type { AccountListItem } from "../../hooks/useAccountsList";
import type { AccountTx } from "../../hooks/useAccountTransactions";

const ACCOUNTS: AccountListItem[] = [
    {
        address: "b521chcut79q8jtc99qs9vcgmdantrmat22xv20m56",
        usdcValue: 9.5,
        balances: [
            { denom: "usdc", amount: "9500000" },
            { denom: "stake", amount: "100" }
        ],
        validatorMoniker: null,
        validatorStatus: null
    },
    {
        address: "b521qqvt4ygyjxnac9xupscgng99k3aqv9u8lqxjjy",
        usdcValue: 1250,
        balances: [{ denom: "usdc", amount: "1250000000" }],
        validatorMoniker: "node1",
        validatorStatus: "BONDED"
    }
];

const TXS: AccountTx[] = [
    { hash: "ABC123HASH", height: "101", timestamp: "", success: true },
    { hash: "DEF456HASH", height: "100", timestamp: "", success: false }
];

function renderColumn(props: Partial<Parameters<typeof AccountsColumn>[0]> = {}) {
    return render(
        <ToastProvider>
            <AccountsColumn
                accounts={ACCOUNTS}
                total={58}
                isLoading={false}
                error=""
                selectedAddress={null}
                onSelectAddress={() => {}}
                selectedTxs={[]}
                txsLoading={false}
                txsError=""
                onTxClick={() => {}}
                hasMore={false}
                expanded={false}
                onToggleShowAll={() => {}}
                {...props}
            />
        </ToastProvider>
    );
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("AccountsColumn", () => {
    it("renders the section title with the total and account rows", () => {
        renderColumn();

        expect(screen.getByText("Accounts")).toBeTruthy();
        expect(screen.getByText("58")).toBeTruthy();
        expect(screen.getByText(/b521chcut7…v20m56/)).toBeTruthy();
        expect(screen.getByText("$9.50")).toBeTruthy();
        expect(screen.getByText("$1,250.00")).toBeTruthy();
        expect(screen.getByText(/validator · node1/)).toBeTruthy();
    });

    it("shows loading / error / empty states", () => {
        renderColumn({ accounts: [], isLoading: true });
        expect(screen.getByText("Loading accounts…")).toBeTruthy();
        cleanup();
        renderColumn({ accounts: [], error: "boom" });
        expect(screen.getByText("boom")).toBeTruthy();
        cleanup();
        renderColumn({ accounts: [], total: 0 });
        expect(screen.getByText("No accounts found.")).toBeTruthy();
    });

    it("expands account detail with address, balances, and validator info", () => {
        renderColumn({ selectedAddress: ACCOUNTS[1].address });

        expect(screen.getByDisplayValue(ACCOUNTS[1].address)).toBeTruthy();
        expect(screen.getByText("1,250.00 USDC")).toBeTruthy();
        expect(screen.getByText("Validator")).toBeTruthy();
        expect(screen.getAllByText(/node1/).length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText("BONDED")).toBeTruthy();
    });

    it("renders the account's transactions with status pills", () => {
        renderColumn({ selectedAddress: ACCOUNTS[1].address, selectedTxs: TXS });

        expect(screen.getByText("Transactions")).toBeTruthy();
        expect(screen.getByText("ABC123HASH…")).toBeTruthy();
        expect(screen.getByText("Success")).toBeTruthy();
        expect(screen.getByText("Failed")).toBeTruthy();
        expect(screen.getByText(/Block #101/)).toBeTruthy();
    });

    it("fires onTxClick when a transaction row is clicked", () => {
        const onTxClick = vi.fn();
        renderColumn({ selectedAddress: ACCOUNTS[1].address, selectedTxs: TXS, onTxClick });

        fireEvent.click(screen.getByText("ABC123HASH…"));
        expect(onTxClick).toHaveBeenCalledWith("ABC123HASH");
    });

    it("shows a Show all footer when there are more accounts, and toggles", () => {
        const onToggleShowAll = vi.fn();
        renderColumn({ hasMore: true, total: 58, onToggleShowAll });

        const button = screen.getByRole("button", { name: "Show all 58" });
        fireEvent.click(button);
        expect(onToggleShowAll).toHaveBeenCalledTimes(1);

        cleanup();
        renderColumn({ hasMore: true, total: 58, expanded: true, onToggleShowAll });
        expect(screen.getByRole("button", { name: "Show less" })).toBeTruthy();
    });

    it("hides the footer when everything is visible", () => {
        renderColumn({ hasMore: false, total: 2, accounts: ACCOUNTS });
        expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
    });
});
