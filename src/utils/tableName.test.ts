import { describe, expect, it } from "vitest";
import { isValidTableName, sanitizeTableNameInput } from "./tableName";

describe("isValidTableName", () => {
    it("accepts lowercase letters, digits and single inner hyphens", () => {
        expect(isValidTableName("friday-degens")).toBe(true);
        expect(isValidTableName("table1")).toBe(true);
    });

    it("rejects uppercase, spaces, apostrophes and edge/double hyphens", () => {
        expect(isValidTableName("Alex's table")).toBe(false);
        expect(isValidTableName("-a")).toBe(false);
        expect(isValidTableName("a-")).toBe(false);
        expect(isValidTableName("a--b")).toBe(false);
    });

    it("rejects empty and over-length names", () => {
        expect(isValidTableName("")).toBe(false);
        expect(isValidTableName("a".repeat(33))).toBe(false);
    });
});

describe("sanitizeTableNameInput", () => {
    it("converts a typed name into a chain-valid slug", () => {
        expect(sanitizeTableNameInput("Alex's table")).toBe("alexs-table");
    });

    it("collapses repeated hyphens but keeps a trailing one while typing", () => {
        expect(sanitizeTableNameInput("a  b")).toBe("a-b");
        expect(sanitizeTableNameInput("ab-")).toBe("ab-");
    });
});
