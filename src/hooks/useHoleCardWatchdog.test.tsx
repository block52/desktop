// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { PlayerStatus, TexasHoldemRound, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { useHoleCardWatchdog } from "./useHoleCardWatchdog";

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

const ME = "b52me";

function state(overrides: { holeCards?: string[]; round?: TexasHoldemRound; handNumber?: number; actionCount?: number }): TexasHoldemStateDTO {
    return {
        round: overrides.round ?? TexasHoldemRound.PREFLOP,
        handNumber: overrides.handNumber ?? 7,
        actionCount: overrides.actionCount ?? 1,
        players: [{ address: ME, status: PlayerStatus.ACTIVE, holeCards: overrides.holeCards }]
    } as unknown as TexasHoldemStateDTO;
}

describe("useHoleCardWatchdog", () => {
    it("re-subscribes once after the grace period when the player's cards are missing", () => {
        vi.useFakeTimers();
        const resubscribe = vi.fn();
        renderHook(() => useHoleCardWatchdog({ gameState: state({}), localAddress: ME, resubscribe }));
        expect(resubscribe).not.toHaveBeenCalled();
        act(() => {
            vi.advanceTimersByTime(1600);
        });
        expect(resubscribe).toHaveBeenCalledTimes(1);
    });

    it("does nothing when the player holds both cards", () => {
        vi.useFakeTimers();
        const resubscribe = vi.fn();
        renderHook(() => useHoleCardWatchdog({ gameState: state({ holeCards: ["AS", "KD"] }), localAddress: ME, resubscribe }));
        act(() => {
            vi.advanceTimersByTime(5000);
        });
        expect(resubscribe).not.toHaveBeenCalled();
    });

    it("does nothing before cards are dealt", () => {
        vi.useFakeTimers();
        const resubscribe = vi.fn();
        renderHook(() => useHoleCardWatchdog({ gameState: state({ round: TexasHoldemRound.ANTE }), localAddress: ME, resubscribe }));
        act(() => {
            vi.advanceTimersByTime(5000);
        });
        expect(resubscribe).not.toHaveBeenCalled();
    });

    it("gives up after two attempts in the same hand", () => {
        vi.useFakeTimers();
        const resubscribe = vi.fn();
        const { rerender } = renderHook(({ actionCount }) => useHoleCardWatchdog({ gameState: state({ actionCount }), localAddress: ME, resubscribe }), {
            initialProps: { actionCount: 1 }
        });
        for (let frame = 2; frame <= 5; frame++) {
            act(() => {
                vi.advanceTimersByTime(1600);
            });
            rerender({ actionCount: frame });
        }
        act(() => {
            vi.advanceTimersByTime(1600);
        });
        expect(resubscribe).toHaveBeenCalledTimes(2);
    });
});
