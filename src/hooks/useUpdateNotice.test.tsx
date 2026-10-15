// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useUpdateNotice } from "./useUpdateNotice";

const check = vi.fn();
const open = vi.fn();

beforeEach(() => {
    window.localStorage.clear();
    Object.assign(window, { electronAPI: { openExternal: vi.fn(), updates: { check, open } } });
});

afterEach(() => {
    check.mockReset();
    open.mockReset();
    Reflect.deleteProperty(window, "electronAPI");
});

describe("useUpdateNotice", () => {
    it("shows a newer version and opens its release page", async () => {
        check.mockResolvedValue({ version: "1.0.7" });
        const { result } = renderHook(() => useUpdateNotice());

        await waitFor(() => expect(result.current.update).toEqual({ version: "1.0.7" }));
        act(() => result.current.download());
        expect(open).toHaveBeenCalledWith("1.0.7");
    });

    it("hides a dismissed version and remembers it", async () => {
        check.mockResolvedValue({ version: "1.0.7" });
        const first = renderHook(() => useUpdateNotice());
        await waitFor(() => expect(first.result.current.update).not.toBeNull());
        act(() => first.result.current.dismiss());
        expect(first.result.current.update).toBeNull();
        first.unmount();

        const second = renderHook(() => useUpdateNotice());
        await waitFor(() => expect(check).toHaveBeenCalledTimes(2));
        expect(second.result.current.update).toBeNull();
    });

    it("shows nothing when there is no update or no desktop bridge", async () => {
        check.mockResolvedValue(null);
        const { result } = renderHook(() => useUpdateNotice());
        await waitFor(() => expect(check).toHaveBeenCalled());
        expect(result.current.update).toBeNull();

        Reflect.deleteProperty(window, "electronAPI");
        const plain = renderHook(() => useUpdateNotice());
        expect(plain.result.current.update).toBeNull();
    });
});
