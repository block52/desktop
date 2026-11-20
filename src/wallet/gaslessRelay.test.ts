import { describe, expect, it, vi } from "vitest";
import type { GaslessDepositRequest } from "./gaslessDeposit";
import { createGaslessRelay } from "./gaslessRelay";

const HASH = `0x${"cd".repeat(32)}`;
const REQUEST: GaslessDepositRequest = { from: "0xabc", value: "1", validAfter: "0", validBefore: "9", salt: "0x01", receiver: "b521x", signature: "0xsig" };

type Reply = { ok?: boolean; status?: number; body: unknown };
function relay(replies: Reply[], clock = { t: 0 }) {
    const fetch = vi.fn(async () => {
        const next = replies.shift();
        if (next === undefined) throw new Error("unexpected request");
        return { ok: next.ok ?? true, status: next.status ?? 200, json: async () => next.body };
    });
    const sleep = vi.fn(async (ms: number) => {
        clock.t += ms;
    });
    return { fetch, sleep, relay: createGaslessRelay({ baseUrl: "https://relay.example/", fetch, sleep, now: () => clock.t }) };
}

describe("createGaslessRelay", () => {
    it("posts the request, then polls until the deposit is confirmed", async () => {
        const { relay: r, fetch } = relay([{ body: { txHash: HASH } }, { body: { status: "pending" } }, { body: { status: "confirmed" } }]);
        await expect(r.submit(REQUEST)).resolves.toBe(HASH);
        const calls = fetch.mock.calls as unknown as Array<[string, { method?: string; body?: string }]>;
        expect(calls[0][0]).toBe("https://relay.example/deposit/gasless");
        expect(calls[0][1].method).toBe("POST");
        expect(JSON.parse(calls[0][1].body ?? "{}")).toEqual(REQUEST);
        expect(calls[1][0]).toBe(`https://relay.example/deposit/status/${HASH}`);
    });

    it("shows the service's reason when it refuses the deposit", async () => {
        const { relay: r } = relay([{ ok: false, status: 400, body: { error: "Minimum deposit is 5 USDC" } }]);
        await expect(r.submit(REQUEST)).rejects.toThrow("Minimum deposit is 5 USDC");
    });

    it("uses a generic message for a refusal with no usable reason, and rejects a malformed hash", async () => {
        await expect(relay([{ ok: false, status: 502, body: null }]).relay.submit(REQUEST)).rejects.toThrow(/did not accept/);
        await expect(relay([{ body: { txHash: "0x123" } }]).relay.submit(REQUEST)).rejects.toThrow(/did not accept/);
        await expect(relay([{ ok: false, body: { error: "x".repeat(500) } }]).relay.submit(REQUEST)).rejects.toThrow(/did not accept/);
    });

    it("fails when the transaction fails on Ethereum", async () => {
        const { relay: r } = relay([{ body: { txHash: HASH } }, { body: { status: "failed" } }]);
        await expect(r.submit(REQUEST)).rejects.toThrow(/failed on Ethereum/);
    });

    it("gives up after a while with a message that says not to send it again", async () => {
        const replies: Reply[] = [{ body: { txHash: HASH } }, ...Array.from({ length: 200 }, () => ({ body: { status: "pending" } }))];
        await expect(relay(replies).relay.submit(REQUEST)).rejects.toThrow(/do not send it again/);
    });
});
