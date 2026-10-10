// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ExplorerStats from "./ExplorerStats";

afterEach(cleanup);

describe("ExplorerStats", () => {
    it("renders all four stat cards with formatted values", () => {
        render(
            <ExplorerStats
                latestHeight="1,284,512"
                avgBlockTimeSeconds={4.12}
                accountsCount={58}
                validatorsCount={4}
            />
        );

        expect(screen.getByText("Latest block")).toBeTruthy();
        expect(screen.getByText("1,284,512")).toBeTruthy();
        expect(screen.getByText("Avg. block time")).toBeTruthy();
        expect(screen.getByText("4.1s")).toBeTruthy();
        expect(screen.getByText("Accounts")).toBeTruthy();
        expect(screen.getByText("58")).toBeTruthy();
        expect(screen.getByText("Validators")).toBeTruthy();
        expect(screen.getByText("4")).toBeTruthy();
    });

    it("shows a dash when a value is unavailable", () => {
        render(
            <ExplorerStats
                latestHeight={null}
                avgBlockTimeSeconds={null}
                accountsCount={0}
                validatorsCount={null}
            />
        );

        expect(screen.getAllByText("—").length).toBe(3);
    });
});
