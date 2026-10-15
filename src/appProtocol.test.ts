import path from "node:path";
import { describe, expect, it } from "vitest";
import { isOwnResource, resolveAppFile } from "./appProtocol";

const root = path.resolve("/srv/renderer/main_window");

describe("resolveAppFile", () => {
    it("serves index.html for the root", () => {
        expect(resolveAppFile(root, "app://block52/")).toBe(path.join(root, "index.html"));
        expect(resolveAppFile(root, "app://block52")).toBe(path.join(root, "index.html"));
    });

    it("maps asset paths into the build folder", () => {
        expect(resolveAppFile(root, "app://block52/assets/index-abc.js?v=1")).toBe(path.join(root, "assets", "index-abc.js"));
    });

    it("refuses paths that climb out of the folder", () => {
        expect(resolveAppFile(root, "app://block52/../secret")).toBe(path.join(root, "secret"));
        expect(resolveAppFile(root, "app://block52/%2e%2e/%2e%2e/etc/passwd")).toBe(path.join(root, "etc", "passwd"));
        expect(resolveAppFile(root, "app://block52/..%2f..%2fetc/passwd")).toBeNull();
    });

    it("refuses another host, another scheme and junk", () => {
        expect(resolveAppFile(root, "app://evil/index.html")).toBeNull();
        expect(resolveAppFile(root, "file:///etc/passwd")).toBeNull();
        expect(resolveAppFile(root, "not a url")).toBeNull();
    });
});

describe("isOwnResource", () => {
    it("matches the app scheme and the dev server only", () => {
        expect(isOwnResource("app://block52/index.html", undefined)).toBe(true);
        expect(isOwnResource("http://localhost:5173/src/app.tsx", "http://localhost:5173")).toBe(true);
        expect(isOwnResource("http://localhost:5173/x", undefined)).toBe(false);
        expect(isOwnResource("https://verify.walletconnect.org/v3/attestation", "http://localhost:5173")).toBe(false);
        expect(isOwnResource("junk", undefined)).toBe(false);
    });
});
