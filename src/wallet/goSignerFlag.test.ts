import { describe, expect, it } from "vitest";
import { goSignerOn } from "./goSignerFlag";

describe("goSignerOn", () => {
    it("signs in Go by default", () => {
        expect(goSignerOn(undefined)).toBe(true);
        expect(goSignerOn("")).toBe(true);
        expect(goSignerOn("true")).toBe(true);
    });

    it("falls back to the TypeScript SDK only when explicitly set to false", () => {
        expect(goSignerOn("false")).toBe(false);
        expect(goSignerOn(" FALSE ")).toBe(false);
    });
});
