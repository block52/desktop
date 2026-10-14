import { COSMOS_CONSTANTS, createSigningClientFromMnemonic, getAddressFromMnemonic } from "@block52/poker-vm-sdk";
import type { SigningCosmosClient } from "@block52/poker-vm-sdk";
import { HDNodeWallet } from "ethers";
import { SIGNING_METHODS } from "./types";
import type { SigningMethod, SignerNetwork } from "./types";

// Same derivation path the wallet uses for the Cosmos key.
const COSMOS_HD_PATH = "m/44'/118'/0'/0/0";
const MICRO = 1_000_000n;

/** Methods that move the user's own funds out. The user is asked in a native dialog the page cannot draw or click. */
const CONFIRMED_METHODS = new Set<SigningMethod>(["sendTokens", "initiateWithdrawal", "createValidator"]);

interface SignerDeps {
    /** Returns the decrypted seed phrase, or throws while the wallet is locked. */
    readMnemonic: () => Promise<string | null>;
    confirm: (title: string, detail: string) => Promise<boolean>;
    fetchNodeInfo?: (restEndpoint: string) => Promise<unknown>;
}

function isSigningMethod(value: unknown): value is SigningMethod {
    return typeof value === "string" && (SIGNING_METHODS as readonly string[]).includes(value);
}

function formatAmount(amount: unknown, denom: unknown): string {
    if (typeof amount !== "bigint") return String(amount);
    if (denom === COSMOS_CONSTANTS.TOKEN_DENOM) {
        const whole = amount / MICRO;
        const fraction = (amount % MICRO).toString().padStart(6, "0").replace(/0+$/, "");
        return `${whole}${fraction === "" ? "" : `.${fraction}`} USDC`;
    }
    return `${amount} ${String(denom)}`;
}

function describeCall(method: SigningMethod, args: unknown[]): { title: string; detail: string } {
    if (method === "sendTokens") {
        return { title: "Send funds?", detail: `Send ${formatAmount(args[2], args[3] ?? COSMOS_CONSTANTS.TOKEN_DENOM)} to\n${String(args[1])}` };
    }
    if (method === "initiateWithdrawal") {
        return { title: "Withdraw funds?", detail: `Withdraw ${formatAmount(args[1], COSMOS_CONSTANTS.TOKEN_DENOM)} to the Ethereum address\n${String(args[0])}` };
    }
    const params = typeof args[0] === "object" && args[0] !== null ? (args[0] as { amount?: unknown; moniker?: unknown }) : {};
    return { title: "Bond a validator?", detail: `Bond ${formatAmount(params.amount, COSMOS_CONSTANTS.TOKEN_DENOM)} as validator "${String(params.moniker)}"` };
}

function assertEndpoint(value: unknown): string {
    if (typeof value !== "string") throw new Error("Invalid network endpoint.");
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Invalid network endpoint.");
    return value;
}

/**
 * Signs for the wallet inside the main process, so the seed phrase and the SDK signing client never
 * exist in the page. The page can only call the fixed methods below.
 */
export class WalletSigner {
    private readonly deps: SignerDeps;
    private clients = new Map<string, Promise<SigningCosmosClient>>();
    private verifiedEndpoints = new Set<string>();

    constructor(deps: SignerDeps) {
        this.deps = deps;
    }

    async address(): Promise<string> {
        return getAddressFromMnemonic(await this.requireMnemonic(), COSMOS_CONSTANTS.ADDRESS_PREFIX);
    }

    /** The message that proves identity when subscribing to a table. Only this exact message shape can be signed. */
    async signQuery(timestamp: number): Promise<string> {
        if (!Number.isInteger(timestamp) || timestamp <= 0) throw new Error("Invalid timestamp.");
        const wallet = HDNodeWallet.fromPhrase(await this.requireMnemonic(), undefined, COSMOS_HD_PATH);
        return wallet.signMessage(`pokerchain-query:${timestamp}`);
    }

    async call(network: SignerNetwork, method: unknown, args: unknown[]): Promise<unknown> {
        if (!isSigningMethod(method)) throw new Error("That wallet action is not available.");
        if (!Array.isArray(args)) throw new Error("Invalid arguments.");
        if (CONFIRMED_METHODS.has(method)) {
            const { title, detail } = describeCall(method, args);
            if (!(await this.deps.confirm(title, detail))) throw new Error("Cancelled.");
        }
        const client = await this.client(network);
        const run = (client as unknown as Record<string, (...callArgs: unknown[]) => Promise<unknown>>)[method];
        return run.apply(client, args);
    }

    reset(): void {
        const previous = [...this.clients.values()];
        this.clients = new Map();
        for (const pending of previous) {
            pending.then(client => client.disconnect()).catch(() => undefined);
        }
    }

    private async requireMnemonic(): Promise<string> {
        const mnemonic = await this.deps.readMnemonic();
        if (mnemonic === null) throw new Error("Block52 wallet not initialized. Please create or import a Block52 wallet first.");
        return mnemonic;
    }

    private client(network: SignerNetwork): Promise<SigningCosmosClient> {
        const rpcEndpoint = assertEndpoint(network.rpc);
        const restEndpoint = assertEndpoint(network.rest);
        const key = `${rpcEndpoint}|${restEndpoint}`;
        const cached = this.clients.get(key);
        if (cached !== undefined) return cached;

        const pending = this.assertServesBlock52(restEndpoint)
            .then(() => this.requireMnemonic())
            .then(mnemonic =>
                createSigningClientFromMnemonic(
                    {
                        rpcEndpoint,
                        restEndpoint,
                        chainId: COSMOS_CONSTANTS.CHAIN_ID,
                        prefix: COSMOS_CONSTANTS.ADDRESS_PREFIX,
                        denom: COSMOS_CONSTANTS.GAS_DENOM,
                        gasPrice: COSMOS_CONSTANTS.DEFAULT_GAS_PRICE,
                    },
                    mnemonic,
                ),
            );
        // A failed build must not stay cached.
        pending.catch(() => {
            if (this.clients.get(key) === pending) this.clients.delete(key);
        });
        this.clients.set(key, pending);
        return pending;
    }

    /** A node picks the chain id a transaction is signed for, so check it serves Block52 before signing against it. */
    private async assertServesBlock52(restEndpoint: string): Promise<void> {
        if (this.verifiedEndpoints.has(restEndpoint)) return;
        const url = `${restEndpoint.replace(/\/+$/, "")}/cosmos/base/tendermint/v1beta1/node_info`;
        const info = this.deps.fetchNodeInfo !== undefined ? await this.deps.fetchNodeInfo(url) : await fetchJson(url);
        const network =
            typeof info === "object" && info !== null && "default_node_info" in info
                ? (info.default_node_info as { network?: unknown } | null)?.network
                : undefined;
        if (network !== COSMOS_CONSTANTS.CHAIN_ID) {
            throw new Error(`This node reports network "${String(network)}", not "${COSMOS_CONSTANTS.CHAIN_ID}". Refusing to sign.`);
        }
        this.verifiedEndpoints.add(restEndpoint);
    }
}

async function fetchJson(url: string): Promise<unknown> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not verify the network (node responded ${response.status})`);
    return response.json();
}
