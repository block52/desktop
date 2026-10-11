import { describe, expect, it } from "vitest";
import { paymentQrValue, toSmallestUnit } from "./cryptoPayment";

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
