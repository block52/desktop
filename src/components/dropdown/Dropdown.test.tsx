// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Dropdown, { DropdownOption } from "./Dropdown";

const OPTIONS: DropdownOption[] = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta", hint: "2 players" }
];

afterEach(cleanup);

describe("Dropdown", () => {
    it("shows the selected option's label on the trigger", () => {
        render(<Dropdown value="a" options={OPTIONS} onSelect={() => {}} placeholder="Pick one" />);
        expect(screen.getByRole("button", { expanded: false }).textContent).toContain("Alpha");
    });

    it("shows the placeholder when no value is selected", () => {
        render(<Dropdown value="" options={OPTIONS} onSelect={() => {}} placeholder="Pick one" />);
        expect(screen.getByRole("button", { expanded: false }).textContent).toContain("Pick one");
    });

    it("opens the popover with placeholder + options on click", () => {
        render(<Dropdown value="a" options={OPTIONS} onSelect={() => {}} placeholder="Pick one" />);
        fireEvent.click(screen.getByRole("button", { expanded: false }));

        // trigger + placeholder row + 2 options
        expect(screen.getAllByRole("button")).toHaveLength(4);
        expect(screen.getByRole("button", { name: /Pick one/ })).toBeTruthy();
        expect(screen.getByText("2 players")).toBeTruthy();
    });

    it("calls onSelect with the option value and closes on selection", () => {
        const onSelect = vi.fn();
        render(<Dropdown value="a" options={OPTIONS} onSelect={onSelect} placeholder="Pick one" />);
        fireEvent.click(screen.getByRole("button", { expanded: false }));
        fireEvent.click(screen.getByRole("button", { name: /Beta/ }));

        expect(onSelect).toHaveBeenCalledWith("b");
        expect(screen.queryByRole("button", { name: /Beta/ })).toBeNull();
    });

    it("closes on Escape", () => {
        const { container } = render(
            <Dropdown value="a" options={OPTIONS} onSelect={() => {}} placeholder="Pick one" />
        );
        fireEvent.click(screen.getByRole("button", { expanded: false }));
        fireEvent.keyDown(container.firstChild as Element, { key: "Escape" });

        expect(screen.queryAllByRole("button", { expanded: true })).toHaveLength(0);
    });

    it("closes on outside mousedown", () => {
        render(
            <div>
                <Dropdown value="a" options={OPTIONS} onSelect={() => {}} placeholder="Pick one" />
                <div data-testid="outside" />
            </div>
        );
        fireEvent.click(screen.getByRole("button", { expanded: false }));
        fireEvent.mouseDown(screen.getByTestId("outside"));

        expect(screen.queryAllByRole("button", { expanded: true })).toHaveLength(0);
    });
});
