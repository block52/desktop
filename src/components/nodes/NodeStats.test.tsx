// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import NodeStats from "./NodeStats";

afterEach(cleanup);

describe("NodeStats", () => {
    it("renders the four node stats", () => {
        render(<NodeStats healthy={3} total={9} validators={4} sync={4} />);

        expect(screen.getByText("Healthy Nodes")).toBeTruthy();
        expect(screen.getByText("3")).toBeTruthy();
        expect(screen.getByText("Total Nodes")).toBeTruthy();
        expect(screen.getByText("9")).toBeTruthy();
        expect(screen.getByText("Validators")).toBeTruthy();
        expect(screen.getByText("Sync Nodes")).toBeTruthy();
        expect(screen.getAllByText("4").length).toBe(2);
    });
});
