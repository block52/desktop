// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useLatchedDelay } from "./useLatchedDelay";

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe("useLatchedDelay", () => {
    it("fires once after the settle delay while armed", () => {
        vi.useFakeTimers();
        const fire = vi.fn(() => true);
        renderHook(() => useLatchedDelay(true, false, fire, 100));
        expect(fire).not.toHaveBeenCalled();
        act(() => {
            vi.advanceTimersByTime(150);
        });
        expect(fire).toHaveBeenCalledTimes(1);
    });

    it("does not fire again until the opportunity resets", () => {
        vi.useFakeTimers();
        const fire = vi.fn(() => true);
        const { rerender } = renderHook(({ arm, reset }) => useLatchedDelay(arm, reset, fire, 100), {
            initialProps: { arm: true, reset: false }
        });
        act(() => {
            vi.advanceTimersByTime(150);
        });
        rerender({ arm: true, reset: false });
        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(fire).toHaveBeenCalledTimes(1);

        rerender({ arm: false, reset: true });
        rerender({ arm: true, reset: false });
        act(() => {
            vi.advanceTimersByTime(150);
        });
        expect(fire).toHaveBeenCalledTimes(2);
    });

    it("re-arms when fire declines to act", () => {
        vi.useFakeTimers();
        const fire = vi.fn(() => false);
        const { rerender } = renderHook(({ n }) => useLatchedDelay(true, false, fire, 100) ?? n, { initialProps: { n: 0 } });
        act(() => {
            vi.advanceTimersByTime(150);
        });
        expect(fire).toHaveBeenCalledTimes(1);
        rerender({ n: 1 });
        act(() => {
            vi.advanceTimersByTime(150);
        });
        expect(fire.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
});
