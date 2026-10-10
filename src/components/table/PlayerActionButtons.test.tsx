// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import PlayerActionButtons, { actionMin, formatAmount, presetForPot, primaryAction } from "./PlayerActionButtons";
import { PlayerActionType } from "@block52/poker-vm-sdk";

afterEach(cleanup);

const BET = { action: PlayerActionType.BET, min: "200000", max: "5000000", index: 0 };
const RAISE = { action: PlayerActionType.RAISE, min: "400000", max: "5000000", index: 1 };
const CALL = { action: PlayerActionType.CALL, min: "200000", max: "200000", index: 2 };
const CHECK = { action: PlayerActionType.CHECK, min: undefined, max: undefined, index: 3 };
const FOLD = { action: PlayerActionType.FOLD, min: undefined, max: undefined, index: 4 };

describe("formatAmount", () => {
    it("formats micro to dollars", () => {
        expect(formatAmount("200000")).toBe("0.20");
        expect(formatAmount("5000000")).toBe("5.00");
        expect(formatAmount("725000000")).toBe("725.00");
    });
});

describe("actionMin", () => {
    it("returns the min of the matching action", () => {
        expect(actionMin([BET, CALL], PlayerActionType.CALL)).toBe("200000");
        expect(actionMin([BET, CALL], PlayerActionType.BET)).toBe("200000");
    });

    it("returns null when the action is not offered", () => {
        expect(actionMin([FOLD], PlayerActionType.CALL)).toBeNull();
    });
});

describe("primaryAction", () => {
    it("prefers bet over raise", () => {
        expect(primaryAction([BET, RAISE])).toEqual({ type: "bet", min: "200000", max: "5000000" });
    });

    it("falls back to raise", () => {
        expect(primaryAction([CALL, RAISE])).toEqual({ type: "raise", min: "400000", max: "5000000" });
    });

    it("returns null when neither is legal", () => {
        expect(primaryAction([CALL, CHECK, FOLD])).toBeNull();
    });
});

describe("presetForPot", () => {
    it("computes the preset amount clamped to the action bounds", () => {
        expect(presetForPot(0.5, 0.4, 0.2, 5)).toBe("0.20"); // 0.2 below min → clamped to min
        expect(presetForPot(0.75, 0.4, 0.2, 5)).toBe("0.30");
        expect(presetForPot(1, 10, 0.2, 5)).toBe("5.00"); // above max → clamped to max
    });
});

const BASE_PROPS = {
    isSubmitting: false,
    legalActions: [BET, CALL, CHECK, FOLD] as never,
    isPlayerTurn: true,
    wagerAmount: "0.40",
    onWagerChange: () => {},
    potValue: 0.4,
    onBet: () => {},
    onCall: () => {},
    onRaise: () => {},
    onCheck: () => {},
    onFold: () => {},
    onMuck: () => {},
    onShow: () => {},
    onSitIn: () => {},
    onSitInAndWait: () => {}
};

describe("PlayerActionButtons", () => {
    it("shows the turn status, presets, and a labelled call button", () => {
        render(<PlayerActionButtons {...BASE_PROPS} />);

        expect(screen.getByText("Your turn")).toBeTruthy();
        expect(screen.getByRole("button", { name: "½ pot" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "¾ pot" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Pot" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Call $0.20" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Bet $0.40" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Check" })).toBeTruthy();
    });

    it("labels the primary as Raise to when only raise is legal", () => {
        render(<PlayerActionButtons {...BASE_PROPS} legalActions={[CALL, RAISE, FOLD] as never} />);
        expect(screen.getByRole("button", { name: "Raise to $0.40" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
    });

    it("disables actions when not the player's turn", () => {
        render(<PlayerActionButtons {...BASE_PROPS} isPlayerTurn={false} />);
        expect(screen.getByText("Not your turn")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Bet $0.40" })).toHaveProperty("disabled", true);
    });

    it("fires the preset handlers with clamped amounts", () => {
        const onWagerChange = vi.fn();
        render(<PlayerActionButtons {...BASE_PROPS} onWagerChange={onWagerChange} potValue={0.4} />);
        fireEvent.click(screen.getByRole("button", { name: "¾ pot" }));
        expect(onWagerChange).toHaveBeenCalledWith("0.30");
    });

    it("hides wager controls when no bet or raise is legal", () => {
        render(<PlayerActionButtons {...BASE_PROPS} legalActions={[CALL, FOLD] as never} />);
        expect(screen.queryByRole("button", { name: "Pot" })).toBeNull();
    });
});
