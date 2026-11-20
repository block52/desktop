import type { GaslessDepositRequest } from "./gaslessDeposit";

/** Submits a signed deposit and waits until it is mined. Injected into the wallet so it can be tested without a network. */
export interface GaslessRelay {
    /** Returns the Ethereum transaction hash once the deposit is confirmed; throws with the relayer's reason if it is refused or fails. */
    submit: (request: GaslessDepositRequest) => Promise<string>;
}

const POLL_INTERVAL_MS = 4_000;
const GIVE_UP_AFTER_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 20_000;

interface Fetch {
    (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }): Promise<{
        ok: boolean;
        status: number;
        json: () => Promise<unknown>;
    }>;
}

interface RelayDeps {
    baseUrl: string;
    fetch?: Fetch;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
}

function field(body: unknown, key: string): unknown {
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>)[key] : undefined;
}

/** A refusal's reason from the relayer, or a generic one. Only plain strings are shown. */
function reason(body: unknown, fallback: string): string {
    const message = field(body, "error") ?? field(body, "message");
    return typeof message === "string" && message !== "" && message.length <= 200 ? message : fallback;
}

/**
 * The relayer's HTTP interface: `POST /deposit/gasless` takes the request and answers `{ txHash }`;
 * `GET /deposit/status/:txHash` answers `{ status: "pending" | "confirmed" | "failed" }`.
 */
export function createGaslessRelay(deps: RelayDeps): GaslessRelay {
    const base = deps.baseUrl.replace(/\/+$/, "");
    const doFetch: Fetch = deps.fetch ?? (globalThis.fetch as unknown as Fetch);
    const sleep = deps.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
    const now = deps.now ?? Date.now;

    const call = async (path: string, init?: { method?: string; body?: string }) => {
        const response = await doFetch(`${base}${path}`, {
            ...init,
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        let body: unknown = null;
        try {
            body = await response.json();
        } catch {
            // not JSON: handled by the status check
        }
        return { ok: response.ok, status: response.status, body };
    };

    return {
        async submit(request) {
            const sent = await call("/deposit/gasless", { method: "POST", body: JSON.stringify(request) });
            const txHash = field(sent.body, "txHash");
            if (!sent.ok || typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
                throw new Error(reason(sent.body, "The deposit service did not accept the deposit."));
            }
            const deadline = now() + GIVE_UP_AFTER_MS;
            while (now() < deadline) {
                await sleep(POLL_INTERVAL_MS);
                const polled = await call(`/deposit/status/${txHash}`);
                const status = field(polled.body, "status");
                if (polled.ok && status === "confirmed") return txHash;
                if (status === "failed") throw new Error(reason(polled.body, "The deposit failed on Ethereum."));
            }
            throw new Error(`The deposit was sent (${txHash}) but is not confirmed yet. Check your Block52 balance later; do not send it again.`);
        },
    };
}
