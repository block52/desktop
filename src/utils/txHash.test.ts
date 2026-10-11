import { describe, expect, it } from "vitest";
import { txHashFromBase64 } from "./txHash";

describe("txHashFromBase64", () => {
    it("is the uppercase hex SHA-256 of the decoded bytes", async () => {
        // SHA-256("abc") = ba7816bf…
        expect(await txHashFromBase64(btoa("abc"))).toBe("BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD");
    });
});
