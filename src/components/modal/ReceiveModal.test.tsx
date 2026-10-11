// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "../../context/ToastContext";
import { ReceiveModal } from "./ReceiveModal";

afterEach(cleanup);

describe("ReceiveModal", () => {
    it("shows the wallet address and a QR code, and closes", () => {
        const onClose = vi.fn();
        const { container } = render(
            <ToastProvider>
                <ReceiveModal address="b5210lpeclqj7xjd0alc796ceuq7gqyskwnsnv5waw" onClose={onClose} />
            </ToastProvider>
        );
        expect(screen.getByText("b5210lpeclqj7xjd0alc796ceuq7gqyskwnsnv5waw")).toBeTruthy();
        expect(container.querySelector("svg")).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
