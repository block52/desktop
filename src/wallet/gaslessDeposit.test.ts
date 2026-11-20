import { HDNodeWallet, verifyTypedData } from "ethers";
import { describe, expect, it } from "vitest";
import { AUTHORIZATION_LIFETIME_SECONDS, RECEIVE_WITH_AUTHORIZATION_TYPES, USDC_DOMAIN, isBlock52Address, nonceFor, signGaslessDeposit } from "./gaslessDeposit";

const MNEMONIC = "test test test test test test test test test test test junk";
const ETH_PATH = "m/44'/60'/0'/0/0";
const RECEIVER = `b521${"q".repeat(38)}`;
const OTHER_RECEIVER = `b521${"p".repeat(38)}`;
const DEPOSITOR = "0x1111111111111111111111111111111111111111";
const SALT = `0x${"ab".repeat(32)}`;
const NOW = 1_800_000_000;

const account = () => HDNodeWallet.fromPhrase(MNEMONIC, undefined, ETH_PATH);

describe("signGaslessDeposit", () => {
    it("signs an authorization that recovers to the wallet and pays the deposit contract", async () => {
        const request = await signGaslessDeposit({ account: account(), depositor: DEPOSITOR, value: 5_000_000n, receiver: RECEIVER, now: NOW, salt: SALT });
        const recovered = verifyTypedData(USDC_DOMAIN, RECEIVE_WITH_AUTHORIZATION_TYPES, {
            from: account().address,
            to: DEPOSITOR,
            value: 5_000_000n,
            validAfter: 0n,
            validBefore: BigInt(NOW + AUTHORIZATION_LIFETIME_SECONDS),
            nonce: nonceFor(RECEIVER, SALT),
        }, request.signature);
        expect(recovered).toBe(account().address);
        expect(request).toMatchObject({
            from: account().address,
            value: "5000000",
            validAfter: "0",
            validBefore: String(NOW + AUTHORIZATION_LIFETIME_SECONDS),
            salt: SALT,
            receiver: RECEIVER,
        });
    });

    it("binds the signature to the receiver: the same signature does not verify for another receiver", async () => {
        const request = await signGaslessDeposit({ account: account(), depositor: DEPOSITOR, value: 1_000_000n, receiver: RECEIVER, now: NOW, salt: SALT });
        const forOther = verifyTypedData(USDC_DOMAIN, RECEIVE_WITH_AUTHORIZATION_TYPES, {
            from: account().address,
            to: DEPOSITOR,
            value: 1_000_000n,
            validAfter: 0n,
            validBefore: BigInt(NOW + AUTHORIZATION_LIFETIME_SECONDS),
            nonce: nonceFor(OTHER_RECEIVER, SALT),
        }, request.signature);
        expect(forOther).not.toBe(account().address);
        expect(nonceFor(RECEIVER, SALT)).not.toBe(nonceFor(OTHER_RECEIVER, SALT));
    });

    it("uses fresh randomness for each deposit when no salt is given", async () => {
        const a = await signGaslessDeposit({ account: account(), depositor: DEPOSITOR, value: 1n, receiver: RECEIVER, now: NOW });
        const b = await signGaslessDeposit({ account: account(), depositor: DEPOSITOR, value: 1n, receiver: RECEIVER, now: NOW });
        expect(a.salt).toMatch(/^0x[0-9a-f]{64}$/);
        expect(a.salt).not.toBe(b.salt);
    });

    it("refuses a zero amount, a malformed receiver or a bad depositor before signing", async () => {
        const base = { account: account(), depositor: DEPOSITOR, value: 1n, receiver: RECEIVER, now: NOW };
        await expect(signGaslessDeposit({ ...base, value: 0n })).rejects.toThrow(/amount/);
        await expect(signGaslessDeposit({ ...base, receiver: "b52myownaddress" })).rejects.toThrow(/Block52 address/);
        await expect(signGaslessDeposit({ ...base, receiver: `${RECEIVER}x` })).rejects.toThrow(/Block52 address/);
        await expect(signGaslessDeposit({ ...base, depositor: "not an address" })).rejects.toThrow();
        await expect(signGaslessDeposit({ ...base, depositor: "0x0000000000000000000000000000000000000000" })).rejects.toThrow(/not configured/);
    });
});

describe("isBlock52Address", () => {
    it("accepts b521 plus 38 bech32 characters only", () => {
        expect(isBlock52Address(RECEIVER)).toBe(true);
        expect(isBlock52Address(`b521${"b".repeat(38)}`)).toBe(false); // b is not in the bech32 alphabet
        expect(isBlock52Address(`b520${"q".repeat(38)}`)).toBe(false);
        expect(isBlock52Address(RECEIVER.slice(1))).toBe(false);
    });
});
