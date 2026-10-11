// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ConnectionBanner from "./ConnectionBanner";

afterEach(cleanup);

describe("ConnectionBanner", () => {
    it("renders nothing while live or idle", () => {
        const { container, rerender } = render(<ConnectionBanner connection={{ status: "live", attempt: 0 }} onRetry={() => undefined} />);
        expect(container.firstChild).toBeNull();
        rerender(<ConnectionBanner connection={{ status: "idle", attempt: 0 }} onRetry={() => undefined} />);
        expect(container.firstChild).toBeNull();
    });

    it("explains a reconnect in progress", () => {
        render(<ConnectionBanner connection={{ status: "reconnecting", attempt: 2 }} onRetry={() => undefined} />);
        expect(screen.getByRole("status").textContent).toContain("attempt 2 of 5");
    });

    it("offers a manual retry once offline", () => {
        const onRetry = vi.fn();
        render(<ConnectionBanner connection={{ status: "offline", attempt: 5 }} onRetry={onRetry} />);
        fireEvent.click(screen.getByRole("button", { name: "Retry now" }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });
});
