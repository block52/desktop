import { afterEach, describe, expect, it, vi } from "vitest";
import { createCryptoPayment, paymentQrValue, toSmallestUnit } from "./cryptoPayment";

describe("toSmallestUnit", () => {
    it("converts without float drift", () => {
        expect(toSmallestUnit(10.5, 6)).toBe("10500000");
        expect(toSmallestUnit(0.1 + 0.2, 6)).toBe("300000");
        expect(toSmallestUnit(0.005, 18)).toBe("5000000000000000");
    });
});

describe("paymentQrValue", () => {
    it("builds a BIP21 link for bitcoin", () => {
        expect(paymentQrValue({ payAddress: "bc1qabc", payAmount: 0.0012, payCurrency: "btc" })).toBe("bitcoin:bc1qabc?amount=0.0012");
    });

    it("builds an EIP-681 token transfer for USDT", () => {
        expect(paymentQrValue({ payAddress: "0xabc", payAmount: 25, payCurrency: "USDTERC20" })).toBe(
            "ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7@1/transfer?address=0xabc&uint256=25000000"
        );
    });

    it("rejects a currency we do not offer", () => {
        expect(() => paymentQrValue({ payAddress: "x", payAmount: 1, payCurrency: "doge" })).toThrow(/Unknown deposit currency/);
    });
});

describe("createCryptoPayment", () => {
    const ETH_ADDRESS = "0x" + "ab".repeat(20);
    const FUTURE = new Date(Date.now() + 3_600_000).toISOString();

    function respondWith(overrides: Record<string, unknown>) {
        const body = {
            success: true,
            payment_id: "p1",
            pay_address: ETH_ADDRESS,
            pay_amount: 25,
            pay_currency: "usdterc20",
            price_amount: 25,
            expires_at: FUTURE,
            ...overrides
        };
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => body })));
    }
    const request = { amount: 25, currency: "usdterc20", cosmosAddress: "b521x" };

    afterEach(() => vi.unstubAllGlobals());

    it("returns a payment that matches the request", async () => {
        respondWith({});
        await expect(createCryptoPayment(request)).resolves.toMatchObject({ paymentId: "p1", payAddress: ETH_ADDRESS });
    });

    it("rejects a different currency, a different price, a malformed address and an expired payment", async () => {
        respondWith({ pay_currency: "btc" });
        await expect(createCryptoPayment(request)).rejects.toThrow(/do not match/);
        respondWith({ price_amount: 5 });
        await expect(createCryptoPayment(request)).rejects.toThrow(/do not match/);
        respondWith({ pay_address: "0x123" });
        await expect(createCryptoPayment(request)).rejects.toThrow(/do not match/);
        respondWith({ expires_at: new Date(Date.now() - 1000).toISOString() });
        await expect(createCryptoPayment(request)).rejects.toThrow(/do not match/);
    });

    it("accepts a bitcoin address for btc and rejects an EVM address for btc", async () => {
        respondWith({ pay_currency: "btc", pay_address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" });
        await expect(createCryptoPayment({ ...request, currency: "btc" })).resolves.toMatchObject({ payCurrency: "btc" });
        respondWith({ pay_currency: "btc", pay_address: ETH_ADDRESS });
        await expect(createCryptoPayment({ ...request, currency: "btc" })).rejects.toThrow(/do not match/);
    });
});
