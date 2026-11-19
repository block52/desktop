import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateSigningClient } = vi.hoisted(() => ({ mockCreateSigningClient: vi.fn() }));

vi.mock("@block52/poker-vm-sdk", async importOriginal => ({
    ...(await importOriginal<typeof import("@block52/poker-vm-sdk")>()),
    createSigningClientFromMnemonic: mockCreateSigningClient,
}));

import { WalletSigner } from "./signer";

// A throwaway test phrase, never used for anything real.
const MNEMONIC = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const NETWORK = { rpc: "http://rpc-a", rest: "http://rest-a" };

function newSigner(options: { mnemonic?: string | null; confirm?: boolean; chain?: string } = {}) {
    const confirm = vi.fn(async () => options.confirm ?? true);
    const fetchNodeInfo = vi.fn(async () => ({ default_node_info: { network: options.chain ?? "pokerchain" } }));
    const readMnemonic = vi.fn(async () => (options.mnemonic === undefined ? MNEMONIC : options.mnemonic));
    return { signer: new WalletSigner({ readMnemonic, confirm, fetchNodeInfo }), confirm, fetchNodeInfo, readMnemonic };
}

function fakeClient() {
    return {
        joinGame: vi.fn(async () => "0xjoin"),
        sendTokens: vi.fn(async () => "0xsend"),
        disconnect: vi.fn(async () => undefined),
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSigningClient.mockImplementation(async () => fakeClient());
});

describe("WalletSigner", () => {
    it("derives the Block52 address from the saved seed", async () => {
        const { signer } = newSigner();

        expect(await signer.address()).toMatch(/^b52/);
    });

    it("signs only the table-subscription message", async () => {
        const { signer } = newSigner();

        const signature = await signer.signQuery(1_700_000_000);

        expect(signature).toMatch(/^0x[0-9a-f]{130}$/);
        await expect(signer.signQuery(-1)).rejects.toThrow("Invalid timestamp");
    });

    it("refuses to sign when no wallet is saved", async () => {
        const { signer } = newSigner({ mnemonic: null });

        await expect(signer.address()).rejects.toThrow("wallet not initialized");
    });

    it("builds one client per network and reuses it", async () => {
        const { signer } = newSigner();

        await signer.call(NETWORK, "joinGame", ["table", 1, 100n]);
        await signer.call(NETWORK, "joinGame", ["table", 2, 100n]);

        expect(mockCreateSigningClient).toHaveBeenCalledTimes(1);
    });

    it("rebuilds after reset", async () => {
        const { signer } = newSigner();

        await signer.call(NETWORK, "joinGame", ["table", 1, 100n]);
        signer.reset();
        await signer.call(NETWORK, "joinGame", ["table", 1, 100n]);

        expect(mockCreateSigningClient).toHaveBeenCalledTimes(2);
    });

    it("retries building the client after a failure instead of caching it", async () => {
        mockCreateSigningClient.mockRejectedValueOnce(new Error("connection refused"));
        const { signer } = newSigner();

        await expect(signer.call(NETWORK, "joinGame", ["table", 1, 100n])).rejects.toThrow("connection refused");
        await expect(signer.call(NETWORK, "joinGame", ["table", 1, 100n])).resolves.toBe("0xjoin");
    });

    it("refuses to sign for a node that serves a different network", async () => {
        const { signer } = newSigner({ chain: "some-other-chain" });

        await expect(signer.call(NETWORK, "joinGame", ["table", 1, 100n])).rejects.toThrow(/Refusing to sign/);
        expect(mockCreateSigningClient).not.toHaveBeenCalled();
    });

    it("does not run methods outside the allow-list, such as reading the wallet out of the client", async () => {
        const { signer } = newSigner();

        await expect(signer.call(NETWORK, "getWallet", [])).rejects.toThrow("not available");
        await expect(signer.call(NETWORK, "constructor", [])).rejects.toThrow("not available");
        expect(mockCreateSigningClient).not.toHaveBeenCalled();
    });

    it("rejects non-http endpoints", async () => {
        const { signer } = newSigner();

        await expect(signer.call({ rpc: "file:///etc/passwd", rest: "http://rest-a" }, "joinGame", [])).rejects.toThrow("Invalid network endpoint");
    });

    it("asks in a native dialog before sending funds, and does not send if declined", async () => {
        const { signer, confirm } = newSigner({ confirm: false });

        await expect(signer.call(NETWORK, "sendTokens", ["b52from", "b52to", 2_500_000n, "usdc"])).rejects.toThrow("Cancelled");

        expect(confirm).toHaveBeenCalledTimes(1);
        expect(confirm.mock.calls[0]).toEqual(["Send funds?", "Send 2.5 USDC to\nb52to"]);
        expect(mockCreateSigningClient).not.toHaveBeenCalled();
    });

    it("sends funds once confirmed", async () => {
        const { signer } = newSigner({ confirm: true });

        await expect(signer.call(NETWORK, "sendTokens", ["b52from", "b52to", 1_000_000n, "usdc"])).resolves.toBe("0xsend");
    });

    it("does not ask about gameplay calls", async () => {
        const { signer, confirm } = newSigner();

        await signer.call(NETWORK, "joinGame", ["table", 1, 100n]);

        expect(confirm).not.toHaveBeenCalled();
    });
});

describe("WalletSigner sending in the Go sidecar", () => {
    const GO_NETWORK = { ...NETWORK, grpc: "grpcs://node:9443" };

    function newGoSigner(options: { confirm?: boolean; chain?: string } = {}) {
        const sendTokensInGo = vi.fn(async () => "0xgosend");
        const confirm = vi.fn(async () => options.confirm ?? true);
        const fetchNodeInfo = vi.fn(async () => ({ default_node_info: { network: options.chain ?? "pokerchain" } }));
        const signer = new WalletSigner({ readMnemonic: async () => MNEMONIC, confirm, fetchNodeInfo, sendTokensInGo });
        return { signer, sendTokensInGo, confirm };
    }

    it("sends through the sidecar after the user confirms, never creating the SDK client", async () => {
        const { signer, sendTokensInGo, confirm } = newGoSigner();
        await expect(signer.call(GO_NETWORK, "sendTokens", ["b52from", "b52to", 2_500_000n, "usdc"])).resolves.toBe("0xgosend");
        expect(confirm).toHaveBeenCalledOnce();
        expect(sendTokensInGo).toHaveBeenCalledWith({ grpc: "grpcs://node:9443", chainId: "pokerchain", from: "b52from", to: "b52to", amount: 2_500_000, denom: "usdc" });
        expect(mockCreateSigningClient).not.toHaveBeenCalled();
    });

    it("never reaches the sidecar when the user cancels the dialog", async () => {
        const { signer, sendTokensInGo } = newGoSigner({ confirm: false });
        await expect(signer.call(GO_NETWORK, "sendTokens", ["b52from", "b52to", 1_000_000n, "usdc"])).rejects.toThrow("Cancelled");
        expect(sendTokensInGo).not.toHaveBeenCalled();
    });

    it("defaults the denom to USDC", async () => {
        const { signer, sendTokensInGo } = newGoSigner();
        await signer.call(GO_NETWORK, "sendTokens", ["b52from", "b52to", 1_000_000n]);
        expect(sendTokensInGo).toHaveBeenCalledWith(expect.objectContaining({ denom: "usdc" }));
    });

    it("refuses malformed arguments", async () => {
        const { signer, sendTokensInGo } = newGoSigner();
        for (const args of [["b52from", "b52to", 5], ["b52from", "b52to", 0n], ["b52from", "b52to", -1n], ["b52from", 7, 1n], ["b52from", "b52to", 1n, 9]]) {
            await expect(signer.call(GO_NETWORK, "sendTokens", args)).rejects.toThrow(/Invalid arguments/);
        }
        await expect(signer.call(GO_NETWORK, "sendTokens", ["b52from", "b52to", BigInt(Number.MAX_SAFE_INTEGER) + 1n])).rejects.toThrow(/Invalid arguments/);
        expect(sendTokensInGo).not.toHaveBeenCalled();
    });

    it("refuses a node that is not Block52 before sending", async () => {
        const { signer, sendTokensInGo } = newGoSigner({ chain: "evil" });
        await expect(signer.call(GO_NETWORK, "sendTokens", ["b52from", "b52to", 1_000_000n, "usdc"])).rejects.toThrow(/Refusing to sign/);
        expect(sendTokensInGo).not.toHaveBeenCalled();
    });

    it("needs the node's gRPC endpoint", async () => {
        const { signer, sendTokensInGo } = newGoSigner();
        await expect(signer.call(NETWORK, "sendTokens", ["b52from", "b52to", 1_000_000n, "usdc"])).rejects.toThrow(/Invalid network endpoint/);
        expect(sendTokensInGo).not.toHaveBeenCalled();
    });

    it("keeps every other method on the SDK client", async () => {
        const { signer, sendTokensInGo } = newGoSigner();
        await signer.call(GO_NETWORK, "joinGame", ["table", 1, 100n]);
        expect(mockCreateSigningClient).toHaveBeenCalledOnce();
        expect(sendTokensInGo).not.toHaveBeenCalled();
    });
});
