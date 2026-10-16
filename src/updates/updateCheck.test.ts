import { describe, expect, it } from "vitest";
import { isNewer, newerVersionFrom, releasePageUrl } from "./updateCheck";

describe("isNewer", () => {
    it("compares major, minor and patch numerically", () => {
        expect(isNewer("1.0.7", "1.0.6")).toBe(true);
        expect(isNewer("1.1.0", "1.0.9")).toBe(true);
        expect(isNewer("2.0.0", "1.9.9")).toBe(true);
        expect(isNewer("1.0.10", "1.0.9")).toBe(true);
    });

    it("is false for the same, an older, or a non-plain version", () => {
        expect(isNewer("1.0.6", "1.0.6")).toBe(false);
        expect(isNewer("1.0.5", "1.0.6")).toBe(false);
        expect(isNewer("1.0.7-beta.1", "1.0.6")).toBe(false);
        expect(isNewer("latest", "1.0.6")).toBe(false);
    });
});

describe("newerVersionFrom", () => {
    it("returns the version of a newer published release", () => {
        expect(newerVersionFrom({ tag_name: "v1.0.7", draft: false, prerelease: false }, "1.0.6")).toEqual({ version: "1.0.7" });
    });

    it("ignores drafts, pre-releases, current and malformed replies", () => {
        expect(newerVersionFrom({ tag_name: "v1.0.7", draft: true }, "1.0.6")).toBeNull();
        expect(newerVersionFrom({ tag_name: "v1.0.7", prerelease: true }, "1.0.6")).toBeNull();
        expect(newerVersionFrom({ tag_name: "v1.0.6" }, "1.0.6")).toBeNull();
        expect(newerVersionFrom({ message: "Not Found" }, "1.0.6")).toBeNull();
        expect(newerVersionFrom(null, "1.0.6")).toBeNull();
    });
});

describe("releasePageUrl", () => {
    it("points at the tag on the project's own releases", () => {
        expect(releasePageUrl("1.0.7")).toBe("https://github.com/block52/desktop/releases/tag/v1.0.7");
    });
});
