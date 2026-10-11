// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import BondValidatorForm, { extractConsensusKey, validateBondForm, votingPowerPercent } from "./BondValidatorForm";

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("extractConsensusKey", () => {
    it("pulls the base64 key out of the show-validator JSON", () => {
        expect(
            extractConsensusKey("{\"@type\":\"/cosmos.crypto.ed25519.PubKey\",\"key\":\"dGVzdA==\"}")
        ).toBe("dGVzdA==");
    });

    it("trims a raw key paste", () => {
        expect(extractConsensusKey("  dGVzdA==  ")).toBe("dGVzdA==");
    });
});

describe("votingPowerPercent", () => {
    it("computes bond share of the enlarged total", () => {
        expect(votingPowerPercent(10, 40)).toBe(20);
        expect(votingPowerPercent(10, 0)).toBe(100);
    });
});

describe("validateBondForm", () => {
    const valid = {
        consensusKey: "dGVzdA==",
        moniker: "my-node",
        bondUsdc: 10,
        commissionRate: 0.1,
        commissionMaxRate: 0.2,
        commissionMaxChangeRate: 0.01,
        confirmedNode: true,
        confirmedUpgrade: true
    };

    it("passes a valid form", () => {
        expect(validateBondForm(valid, 40, 10)).toBe("");
    });

    it("requires key, moniker, and confirmations", () => {
        expect(validateBondForm({ ...valid, consensusKey: "" }, 40, 10)).toContain("public key");
        expect(validateBondForm({ ...valid, moniker: " " }, 40, 10)).toContain("Moniker");
        expect(validateBondForm({ ...valid, confirmedNode: false }, 40, 10)).toContain("Confirm both");
    });

    it("enforces the minimum bond and balance", () => {
        expect(validateBondForm({ ...valid, bondUsdc: 5 }, 40, 10)).toContain("Minimum self-bond is 10");
        expect(validateBondForm({ ...valid, bondUsdc: 50 }, 40, 10)).toContain("exceeds your wallet balance");
    });

    it("validates commission ranges", () => {
        expect(validateBondForm({ ...valid, commissionRate: 2 }, 40, 10)).toContain("0 and 1");
        expect(validateBondForm({ ...valid, commissionMaxRate: 0.05 }, 40, 10)).toContain("Max commission");
    });
});

describe("BondValidatorForm", () => {
    function fillAndSubmit(onBond = vi.fn()) {
        render(
            <BondValidatorForm
                walletBalanceUsdc={40}
                minBondUsdc={10}
                totalBondedUsdc={40}
                onBond={onBond}
                isBonding={false}
                error=""
                resultHash=""
            />
        );
        fireEvent.change(screen.getByPlaceholderText("Paste the output of pokerchaind comet show-validator"), {
            target: { value: "{\"key\":\"dGVzdA==\"}" }
        });
        fireEvent.change(screen.getByPlaceholderText("e.g. MDAssets"), { target: { value: "my-node" } });
        fireEvent.change(screen.getByPlaceholderText("10"), { target: { value: "10" } });
        fireEvent.click(screen.getByRole("checkbox", { name: /My node is running/ }));
        fireEvent.click(screen.getByRole("checkbox", { name: /I will upgrade pokerchaind/ }));
        fireEvent.click(screen.getByRole("button", { name: "Bond validator" }));
        return onBond;
    }

    it("submits a valid bond payload", () => {
        const onBond = fillAndSubmit();
        expect(onBond).toHaveBeenCalledTimes(1);
        const payload = onBond.mock.calls[0][0];
        expect(payload.consensusPubkeyBase64).toBe("dGVzdA==");
        expect(payload.moniker).toBe("my-node");
        expect(payload.amountMicro).toBe(10_000_000n);
        expect(payload.commissionRate).toBe("0.10");
    });

    it("blocks submit until both confirmations are checked", () => {
        const onBond = vi.fn();
        render(
            <BondValidatorForm
                walletBalanceUsdc={40}
                minBondUsdc={10}
                totalBondedUsdc={40}
                onBond={onBond}
                isBonding={false}
                error=""
                resultHash=""
            />
        );
        fireEvent.change(screen.getByPlaceholderText("Paste the output of pokerchaind comet show-validator"), {
            target: { value: "dGVzdA==" }
        });
        fireEvent.change(screen.getByPlaceholderText("e.g. MDAssets"), { target: { value: "my-node" } });
        fireEvent.change(screen.getByPlaceholderText("10"), { target: { value: "10" } });
        fireEvent.click(screen.getByRole("button", { name: "Bond validator" }));
        expect(onBond).not.toHaveBeenCalled();
        expect(screen.getByText(/Confirm both statements/)).toBeTruthy();
    });

    it("shows the live voting-power estimate", () => {
        render(
            <BondValidatorForm
                walletBalanceUsdc={40}
                minBondUsdc={10}
                totalBondedUsdc={40}
                onBond={vi.fn()}
                isBonding={false}
                error=""
                resultHash=""
            />
        );
        expect(screen.getByText(/20\.00% of voting power/)).toBeTruthy();
    });

    it("renders the wallet balance hint and bonding state", () => {
        render(
            <BondValidatorForm
                walletBalanceUsdc={5.1}
                minBondUsdc={10}
                totalBondedUsdc={40}
                onBond={vi.fn()}
                isBonding={true}
                error=""
                resultHash=""
            />
        );
        expect(screen.getByText(/Your wallet has 5\.10 USDC/)).toBeTruthy();
        expect(screen.getByRole("button", { name: "Bonding…" })).toBeTruthy();
    });
});
