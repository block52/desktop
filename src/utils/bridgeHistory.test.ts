// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { loadLocalDeposits, mergeBridgeHistory, parseMintEvents, saveLocalDeposit } from "./bridgeHistory";
import type { ChainMint, LocalDeposit } from "./bridgeHistory";

const HASH_A = `0x${"a".repeat(64)}`;
const HASH_B = `0x${"b".repeat(64)}`;
const ME = "b521me";

function deposit(hash: string, amount: string, time: number): LocalDeposit {
    return { hash, amount, token: "USDC", time };
}

function mint(amount: string, height: number, time: number, kind: ChainMint["kind"] = "minted"): ChainMint {
    return { kind, amount, height, time, ...(kind === "skipped" ? { reason: "bad" } : {}) };
}

beforeEach(() => window.localStorage.clear());

describe("local deposits", () => {
    it("keeps deposits per address, newest first, once per hash, and survives junk", () => {
        expect(loadLocalDeposits(ME)).toEqual([]);
        saveLocalDeposit(ME, deposit(HASH_A, "5000000", 1));
        saveLocalDeposit(ME, deposit(HASH_B, "1000000", 2));
        saveLocalDeposit(ME, deposit(HASH_A.toUpperCase().replace("0X", "0x"), "5000000", 3));
        expect(loadLocalDeposits(ME).map(d => d.time)).toEqual([3, 2]);
        expect(loadLocalDeposits("b521other")).toEqual([]);
        window.localStorage.setItem(`b52.bridgeDeposits.${ME}`, "not json");
        expect(loadLocalDeposits(ME)).toEqual([]);
        window.localStorage.setItem(`b52.bridgeDeposits.${ME}`, JSON.stringify([{ hash: "nope" }, deposit(HASH_A, "1", 1)]));
        expect(loadLocalDeposits(ME)).toHaveLength(1);
    });
});

describe("parseMintEvents", () => {
    const event = (type: string, recipient: string, amount: string, reason?: string) => ({
        type,
        attributes: [
            { key: "recipient", value: recipient },
            { key: "amount", value: amount },
            ...(reason !== undefined ? [{ key: "reason", value: reason }] : [])
        ]
    });
    it("reads this address's mints and skips, ignoring others and other event types", () => {
        const events = [event("deposit_synced", ME.toUpperCase(), "5000000"), event("deposit_skipped", ME, "1000000", "bad"), event("deposit_synced", "b521x", "7"), event("transfer", ME, "9"), event("deposit_synced", ME, "oops")];
        expect(parseMintEvents(events, ME, 50, 1000)).toEqual([
            { kind: "minted", amount: "5000000", height: 50, time: 1000 },
            { kind: "skipped", amount: "1000000", height: 50, time: 1000, reason: "bad" }
        ]);
    });
});

describe("mergeBridgeHistory", () => {
    it("shows a recorded deposit the chain has not processed as sent", () => {
        const rows = mergeBridgeHistory([{ ...deposit(HASH_A, "5000000", 10), processed: false }], []);
        expect(rows).toEqual([{ key: HASH_A, status: "sent", amount: "5000000", token: "USDC", time: 10, txHash: HASH_A, mintHeight: null, reason: null }]);
    });

    it("pairs a processed deposit with the chain mint so it shows once, with its hash and mint block", () => {
        const rows = mergeBridgeHistory([{ ...deposit(HASH_A, "5000000", 10), processed: true }], [mint("5000000", 50, 20)]);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ status: "minted", txHash: HASH_A, mintHeight: 50, time: 20 });
    });

    it("pairs equal amounts in order, and lists the leftover mint without a hash", () => {
        const rows = mergeBridgeHistory(
            [
                { ...deposit(HASH_A, "5000000", 10), processed: true },
                { ...deposit(HASH_B, "5000000", 30), processed: true }
            ],
            [mint("5000000", 50, 20), mint("5000000", 100, 40), mint("5000000", 150, 60)]
        );
        expect(rows.map(r => [r.txHash === null ? "other" : r.txHash === HASH_A ? "A" : "B", r.mintHeight])).toEqual([["other", 150], ["B", 100], ["A", 50]]);
    });

    it("does not pair a mint that came before the deposit was sent", () => {
        const rows = mergeBridgeHistory([{ ...deposit(HASH_A, "5000000", 100), processed: true }], [mint("5000000", 50, 20)]);
        expect(rows.find(r => r.txHash === HASH_A)?.mintHeight).toBeNull();
        expect(rows.some(r => r.txHash === null && r.mintHeight === 50)).toBe(true);
    });

    it("lists a skipped deposit with its reason, newest first", () => {
        const rows = mergeBridgeHistory([], [mint("1000000", 50, 20, "skipped"), mint("2000000", 100, 40)]);
        expect(rows.map(r => r.status)).toEqual(["minted", "skipped"]);
        expect(rows[1].reason).toBe("bad");
    });
});
