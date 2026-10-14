// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../utils/cosmos/walletBridge", () => ({
    requireWalletBridge: () => ({
        generate: vi.fn(async () => ({
            mnemonic: "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray",
            address: "b5210lpeclqj7xjd0alc796ceuq7gqyskwnsnv5waw"
        })),
        getAddress: vi.fn(async () => "b5210lpeclqj7xjd0alc796ceuq7gqyskwnsnv5waw"),
        importMnemonic: vi.fn(async () => "b5210lpeclqj7xjd0alc796ceuq7gqyskwnsnv5waw")
    })
}));
vi.mock("../utils/cosmos/storage", () => ({
    getCosmosAddress: vi.fn(() => null),
    setCosmosAddress: vi.fn()
}));
vi.mock("../hooks/useCosmosWallet", () => ({ useCosmosWallet: () => ({ address: null, balance: [], refreshBalance: vi.fn() }) }));
vi.mock("../context/NetworkContext", () => ({ useNetwork: () => ({ currentNetwork: { rpc: "", rest: "" } }) }));
vi.mock("../hooks/useWithdrawalActivity", () => ({ useWithdrawalActivity: () => ({ items: [] }) }));
vi.mock("../hooks/useOnChainAvatar", () => ({ useOnChainAvatar: () => null }));
vi.mock("../hooks/useCopyToClipboard", () => ({ useCopyToClipboard: () => vi.fn() }));
vi.mock("@reown/appkit/react", () => ({
    useAppKit: () => ({ open: vi.fn() }),
    useAppKitAccount: () => ({ address: undefined, isConnected: false })
}));
vi.mock("../components/wallet/AvailableCard", () => ({ default: () => <div>available card</div> }));
vi.mock("../components/wallet/ActivityPanel", () => ({ default: () => <div>activity</div> }));
vi.mock("../components/wallet/DepositWithdrawPanel", () => ({ default: () => <div>panel</div> }));

import Wallet from "./Wallet";

afterEach(cleanup);

describe("Wallet page: generating a wallet", () => {
    it("keeps the seed phrase on screen until the user confirms it is saved", async () => {
        render(<Wallet />);
        fireEvent.click(await screen.findByRole("button", { name: "Generate New Wallet" }));

        expect(await screen.findByText("Your Seed Phrase")).toBeTruthy();
        expect(screen.getByText(/Write down your seed phrase/)).toBeTruthy();
        expect(screen.queryByText("available card")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "I have saved my seed phrase" }));
        await waitFor(() => expect(screen.getByText("available card")).toBeTruthy());
        expect(screen.queryByText("Your Seed Phrase")).toBeNull();
    });
});
