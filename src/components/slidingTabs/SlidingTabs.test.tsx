// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SlidingTabs from "./SlidingTabs";

const OPTIONS = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" }
];

describe("SlidingTabs", () => {
    afterEach(() => cleanup());

    it("marks the current option as selected", () => {
        render(<SlidingTabs label="Test" options={OPTIONS} value="b" onChange={() => undefined} />);
        expect(screen.getByRole("tab", { name: "Beta" }).getAttribute("aria-selected")).toBe("true");
        expect(screen.getByRole("tab", { name: "Alpha" }).getAttribute("aria-selected")).toBe("false");
    });

    it("reports the clicked option", () => {
        const onChange = vi.fn();
        render(<SlidingTabs label="Test" options={OPTIONS} value="a" onChange={onChange} />);
        fireEvent.click(screen.getByRole("tab", { name: "Beta" }));
        expect(onChange).toHaveBeenCalledWith("b");
    });
});
