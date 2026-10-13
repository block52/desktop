import { describe, expect, it } from "vitest";
import { isValidBech32Address } from "./bech32";

const VALID = "b5210lpeclqj7xjd0alc796ceuq7gqyskwnsnv5waw";

describe("isValidBech32Address", () => {
    it("accepts a real Block52 address", () => {
        expect(isValidBech32Address(VALID, "b52")).toBe(true);
    });

    it("rejects a single changed character (checksum)", () => {
        const typo = `${VALID.slice(0, 20)}${VALID[20] === "q" ? "p" : "q"}${VALID.slice(21)}`;
        expect(isValidBech32Address(typo, "b52")).toBe(false);
    });

    it("rejects the wrong prefix, uppercase, truncation and junk", () => {
        expect(isValidBech32Address(VALID, "cosmos")).toBe(false);
        expect(isValidBech32Address(VALID.toUpperCase(), "b52")).toBe(false);
        expect(isValidBech32Address(VALID.slice(0, -3), "b52")).toBe(false);
        expect(isValidBech32Address("b521" + "q".repeat(38), "b52")).toBe(false);
        expect(isValidBech32Address("", "b52")).toBe(false);
    });
});
