import { describe, expect, it } from "vitest";
import { sidecarBinaryName } from "./sidecarBinary";

describe("sidecarBinaryName", () => {
    it("adds .exe on Windows, where a file without it cannot be started", () => {
        expect(sidecarBinaryName("win32")).toBe("b52-wallet.exe");
    });

    it("has no extension on macOS and Linux", () => {
        expect(sidecarBinaryName("darwin")).toBe("b52-wallet");
        expect(sidecarBinaryName("linux")).toBe("b52-wallet");
    });
});
