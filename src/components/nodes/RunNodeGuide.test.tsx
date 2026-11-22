// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ToastProvider } from "@block52/ui-sdk";
import RunNodeGuide, {
    appToml,
    buildSeeds,
    initCommands,
    isLoopbackUrl,
    localAppConfig,
    p2pConfig,
    startCommands,
    stateSyncConfig,
    versionCommand
} from "./RunNodeGuide";

const GUIDE = {
    chainVersion: "0.1.73",
    seeds: "abc123@node1.block52.xyz:26656,def456@node.texashodl.net:26656",
    rpcServers: ["https://node1.block52.xyz/rpc/", "https://node.texashodl.net/rpc/"],
    trustHeight: "505877",
    trustHash: "A1B2C3HASH"
};

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("command builders", () => {
    it("versionCommand checks the installed binary", () => {
        expect(versionCommand()).toBe("pokerchaind version");
    });

    it("initCommands install the official genesis from the mirror and check its built-in SHA-256", () => {
        const out = initCommands();
        expect(out).toContain("pokerchaind init <your-moniker> --chain-id pokerchain --home ~/.pokerchain");
        expect(out).toContain(
            "curl -fSL \"https://raw.githubusercontent.com/block52/pokerchain-releases/05fb0712b3d25b8b7c5a1be70d370405897a681f/networks/pokerchain/genesis.json\" -o ~/.pokerchain/config/genesis.json"
        );
        expect(out).toContain(
            "(cd ~/.pokerchain/config && echo \"ae808c4889f1c520c92f40d55dd984d41fec7a03b0373170dcafdeeaf1454731  genesis.json\" | sha256sum -c -)"
        );
        // never a node's own /genesis (different layout, different hash)
        expect(out).not.toMatch(/\/genesis"/);
    });

    it("p2pConfig renders seeds and persistent peers", () => {
        const out = p2pConfig(GUIDE.seeds);
        expect(out).toContain(`seeds = "${GUIDE.seeds}"`);
        expect(out).toContain(`persistent_peers = "${GUIDE.seeds}"`);
    });

    it("stateSyncConfig renders live trust values", () => {
        const out = stateSyncConfig(GUIDE.rpcServers, GUIDE.trustHeight, GUIDE.trustHash);
        expect(out).toContain("enable = true");
        expect(out).toContain("rpc_servers = \"https://node1.block52.xyz/rpc/,https://node.texashodl.net/rpc/\"");
        expect(out).toContain(`trust_height = ${GUIDE.trustHeight}`);
        expect(out).toContain(`trust_hash = "${GUIDE.trustHash}"`);
    });

    it("appToml puts the embedded engine in the [pvm] section pokerchaind reads", () => {
        const out = appToml();
        expect(out).toContain("minimum-gas-prices = \"0usdc\"");
        expect(out).toContain("snapshot-interval = 1000");
        expect(out).toContain("[pvm]\npvm_url = \"\"\nembedded_engine = \"embedded\"");
        expect(out).not.toContain("[engine]");
    });

    it("localAppConfig turns on the REST API and CORS for the app", () => {
        const out = localAppConfig();
        expect(out).toContain("[api]\nenable = true\nenabled-unsafe-cors = true");
        expect(out).toContain("[rpc]\ncors_allowed_origins = [\"*\"]");
    });

    it("isLoopbackUrl spots nodes on this machine", () => {
        expect(isLoopbackUrl("http://localhost:26657")).toBe(true);
        expect(isLoopbackUrl("http://127.0.0.1:8546")).toBe(true);
        expect(isLoopbackUrl("http://[::1]:26657")).toBe(true);
        expect(isLoopbackUrl("https://node1.block52.xyz/rpc/")).toBe(false);
    });

    it("buildSeeds joins node ids at the default p2p port", () => {
        expect(buildSeeds([{ host: "node1.block52.xyz", nodeId: "abc123" }, { host: "node2.block52.xyz", nodeId: null }])).toBe(
            "abc123@node1.block52.xyz:26656"
        );
    });

    it("startCommands start the node and check it has caught up", () => {
        expect(startCommands()).toContain("pokerchaind start --home ~/.pokerchain");
        expect(startCommands()).toContain("curl -s localhost:26657/status | jq .result.sync_info.catching_up");
    });
});

describe("RunNodeGuide", () => {
    it("renders all five steps with copyable code blocks", () => {
        render(
            <ToastProvider>
                <RunNodeGuide {...GUIDE} />
            </ToastProvider>
        );

        expect(screen.getByText(/Install pokerchain 0\.1\.73/)).toBeTruthy();
        expect(screen.getByText(/Initialise the home dir and install the genesis/)).toBeTruthy();
        expect(screen.getByText(/Peers, discovery and state sync/)).toBeTruthy();
        expect(screen.getByText(/Let this app use the node/)).toBeTruthy();
        expect(screen.getByText(/Start and wait for sync/)).toBeTruthy();

        // one copy button per code block (7 blocks)
        expect(screen.getAllByRole("button", { name: "Copy" }).length).toBe(7);
        expect(screen.getByText(/trust_hash = "A1B2C3HASH"/)).toBeTruthy();
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it("warns when fewer than two state-sync servers answered", () => {
        render(
            <ToastProvider>
                <RunNodeGuide {...GUIDE} rpcServers={["https://node1.block52.xyz/rpc/"]} />
            </ToastProvider>
        );
        expect(screen.getByRole("alert").textContent).toContain("needs at least 2 RPC servers, and only 1 answered");
    });
});
