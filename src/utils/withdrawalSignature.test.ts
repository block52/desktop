import { afterEach, describe, expect, it, vi } from "vitest";
import { describeWithdrawError, fetchWithdrawalSignature } from "./withdrawalSignature";

const NONCE = `0x${"0".repeat(63)}5`;
const RECEIVER = "0x439cc0da0773bf078160f36afe816f5079a599f3";
const SIGNATURE = `0x${"ab".repeat(65)}`;
const WITHDRAWAL = { nonce: NONCE, baseAddress: RECEIVER, amount: "1000000" };

function reply(body: unknown, status = 200) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: status === 200, status, json: async () => body }));
}

describe("fetchWithdrawalSignature", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("returns the signature for a matching reply", async () => {
        reply({ receiver: RECEIVER, amount: "1000000", nonce: NONCE, signature: SIGNATURE });
        await expect(fetchWithdrawalSignature("https://node/", WITHDRAWAL)).resolves.toBe(SIGNATURE);
    });

    it("refuses a reply for another receiver, amount or nonce", async () => {
        reply({ receiver: "0xdead", amount: "1000000", nonce: NONCE, signature: SIGNATURE });
        await expect(fetchWithdrawalSignature("https://node", WITHDRAWAL)).rejects.toThrow("different address");
        reply({ receiver: RECEIVER, amount: "999", nonce: NONCE, signature: SIGNATURE });
        await expect(fetchWithdrawalSignature("https://node", WITHDRAWAL)).rejects.toThrow("different amount");
        reply({ receiver: RECEIVER, amount: "1000000", nonce: `0x${"0".repeat(64)}`, signature: SIGNATURE });
        await expect(fetchWithdrawalSignature("https://node", WITHDRAWAL)).rejects.toThrow("different withdrawal");
    });

    it("refuses a malformed signature and a node that has none", async () => {
        reply({ receiver: RECEIVER, amount: "1000000", nonce: NONCE, signature: "0x12" });
        await expect(fetchWithdrawalSignature("https://node", WITHDRAWAL)).rejects.toThrow("Malformed");
        reply({}, 404);
        await expect(fetchWithdrawalSignature("https://node", WITHDRAWAL)).rejects.toThrow("HTTP 404");
    });
});

describe("describeWithdrawError", () => {
    it("turns wallet and contract messages into something to act on", () => {
        expect(describeWithdrawError("execution reverted: nonce already used")).toContain("already been paid out");
        expect(describeWithdrawError("User rejected the request.")).toContain("rejected");
        expect(describeWithdrawError("An unknown RPC error occurred.")).toContain("Ethereum mainnet");
        expect(describeWithdrawError("something odd\nwith detail")).toBe("something odd");
    });
});
