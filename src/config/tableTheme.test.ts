// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { isTableTheme, loadTableTheme, nextTableTheme, saveTableTheme } from "./tableTheme";

afterEach(() => localStorage.clear());

describe("tableTheme", () => {
    it("defaults to modern", () => {
        expect(loadTableTheme()).toBe("modern");
    });

    it("round-trips a saved theme", () => {
        saveTableTheme("nouns");
        expect(loadTableTheme()).toBe("nouns");
    });

    it("ignores an unknown stored value", () => {
        localStorage.setItem("b52_table_theme", "neon");
        expect(loadTableTheme()).toBe("modern");
        expect(isTableTheme("neon")).toBe(false);
    });

    it("cycles modern → classic → nouns → modern", () => {
        expect(nextTableTheme("modern")).toBe("classic");
        expect(nextTableTheme("classic")).toBe("nouns");
        expect(nextTableTheme("nouns")).toBe("modern");
    });
});
