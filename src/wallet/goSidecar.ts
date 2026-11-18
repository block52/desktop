import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";
import { app } from "electron";

/**
 * Client for the Go wallet sidecar (`sidecar/`, built to a `b52-wallet` binary).
 *
 * The sidecar is a stateless, loopback-only crypto helper: it does the pure
 * wallet crypto (generate, derive, address, EIP-191 signQuery) with the shared
 * Go module, matching the TypeScript/SDK output byte for byte. It never opens a
 * port and never persists anything — the sealed vault and the OS keychain stay
 * on this (Electron main) side. We talk to it with one JSON request per line in
 * and one JSON response per line out.
 */

interface SidecarResponse {
    id: number;
    result?: unknown;
    error?: string;
}

function binaryName(): string {
    return process.platform === "win32" ? "b52-wallet.exe" : "b52-wallet";
}

/** Dev: sidecar/dist/<bin> next to the repo. Packaged: bundled via forge extraResource. */
function binaryPath(): string {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, binaryName());
    }
    return path.join(app.getAppPath(), "sidecar", "dist", binaryName());
}

export class WalletSidecar {
    private proc: ChildProcessWithoutNullStreams | null = null;
    private nextId = 1;
    private readonly pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

    private process(): ChildProcessWithoutNullStreams {
        if (this.proc !== null && this.proc.exitCode === null) return this.proc;

        const proc = spawn(binaryPath(), [], { stdio: ["pipe", "pipe", "pipe"] });
        const rl = createInterface({ input: proc.stdout });
        rl.on("line", line => {
            if (line.trim() === "") return;
            let message: SidecarResponse;
            try {
                message = JSON.parse(line) as SidecarResponse;
            } catch {
                return;
            }
            const waiter = this.pending.get(message.id);
            if (waiter === undefined) return;
            this.pending.delete(message.id);
            if (typeof message.error === "string" && message.error !== "") waiter.reject(new Error(message.error));
            else waiter.resolve(message.result);
        });
        const failAll = (error: Error): void => {
            for (const waiter of this.pending.values()) waiter.reject(error);
            this.pending.clear();
            if (this.proc === proc) this.proc = null;
        };
        proc.on("exit", () => failAll(new Error("wallet sidecar exited")));
        proc.on("error", error => failAll(error instanceof Error ? error : new Error(String(error))));
        this.proc = proc;
        return proc;
    }

    private call(method: string, params: Record<string, unknown>): Promise<unknown> {
        const proc = this.process();
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            proc.stdin.write(JSON.stringify({ id, method, ...params }) + "\n", error => {
                if (error !== null && error !== undefined) {
                    this.pending.delete(id);
                    reject(error);
                }
            });
        });
    }

    async generate(bits: number): Promise<{ mnemonic: string; address: string }> {
        return (await this.call("generate", { bits })) as { mnemonic: string; address: string };
    }

    async address(mnemonic: string): Promise<string> {
        return ((await this.call("address", { mnemonic })) as { address: string }).address;
    }

    async validateMnemonic(mnemonic: string): Promise<boolean> {
        return ((await this.call("validateMnemonic", { mnemonic })) as { valid: boolean }).valid;
    }

    async signQuery(mnemonic: string, timestamp: number): Promise<string> {
        return ((await this.call("signQuery", { mnemonic, timestamp })) as { signature: string }).signature;
    }

    /**
     * Signs a game action as an ordered (account-sequence) transaction and
     * broadcasts it over gRPC — the same tx model as the SDK's performActionSync.
     * Rejects with an Error whose .sequenceMismatch is true for a code-32 so the
     * caller can run its existing retry.
     */
    async broadcast(params: {
        mnemonic: string;
        grpc: string;
        chainId: string;
        kind: "action" | "join" | "leave" | "topUp";
        gameId: string;
        action?: string;
        amount?: number;
        data?: string;
        seat?: number;
        buyIn?: number;
    }): Promise<{ txHash: string; gameId: string }> {
        return (await this.call("broadcast", params)) as { txHash: string; gameId: string };
    }

    stop(): void {
        if (this.proc !== null) {
            this.proc.kill();
            this.proc = null;
        }
    }
}
