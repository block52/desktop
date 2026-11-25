import { describe, expect, it } from "vitest";
import { deepLinkFor, findDeepLink, isDeepLinkRoute, parseDeepLink } from "./deepLink";

const ID = `0x${"6c".repeat(32)}`;

describe("parseDeepLink", () => {
    it("opens a table, a tournament table and a tournament", () => {
        expect(parseDeepLink(`block52://table/${ID}`)).toBe(`/table/${ID}`);
        expect(parseDeepLink(`block52://table/${ID}-t3`)).toBe(`/table/${ID}-t3`);
        expect(parseDeepLink(`block52://tournament/${ID}`)).toBe(`/tournament/${ID}`);
    });

    it("lower-cases the id and ignores a trailing slash, query and fragment", () => {
        expect(parseDeepLink(`BLOCK52://table/${ID.toUpperCase().replace("0X", "0x")}/?ref=x#y`)).toBe(`/table/${ID}`);
    });

    it("refuses another scheme, host, extra path, bad id or credentials", () => {
        const bad = [
            `https://table/${ID}`,
            `block52://wallet/${ID}`,
            `block52://table/${ID}/extra`,
            `block52://table/0x1234`,
            `block52://table/${ID}-x1`,
            `block52://tournament/${ID}-t1`,
            `block52://user:pw@table/${ID}`,
            `block52://table/`,
            `block52://table/%E0%A4%A`,
            "block52://",
            "not a url",
            ""
        ];
        for (const link of bad) expect(parseDeepLink(link), link).toBeNull();
    });

    it("cannot be used to reach another route", () => {
        expect(parseDeepLink(`block52://table/..%2Fwallet`)).toBeNull();
        expect(parseDeepLink(`block52://table//wallet`)).toBeNull();
    });
});

describe("findDeepLink", () => {
    it("takes the first valid link on a command line and skips the rest", () => {
        expect(findDeepLink(["/usr/bin/block52", "--flag", "block52://nope/1", `block52://table/${ID}`])).toBe(`/table/${ID}`);
        expect(findDeepLink(["/usr/bin/block52", "--flag"])).toBeNull();
    });
});

describe("isDeepLinkRoute", () => {
    it("accepts only the two routes a link can produce", () => {
        expect(isDeepLinkRoute(`/table/${ID}`)).toBe(true);
        expect(isDeepLinkRoute(`/tournament/${ID}`)).toBe(true);
        expect(isDeepLinkRoute(`/tournament/${ID}-t1`)).toBe(false);
        expect(isDeepLinkRoute("/wallet")).toBe(false);
        expect(isDeepLinkRoute(42)).toBe(false);
    });
});

describe("deepLinkFor", () => {
    it("builds a link that parses back to the same route", () => {
        expect(parseDeepLink(deepLinkFor("table", ID))).toBe(`/table/${ID}`);
        expect(parseDeepLink(deepLinkFor("tournament", ID))).toBe(`/tournament/${ID}`);
    });
});
