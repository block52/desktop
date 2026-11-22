// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ToastProvider } from "@block52/ui-sdk";
import RunNodeGuide, {
    appToml,
    buildSeeds,
    GENESIS_SHA256,
    GENESIS_URL,
    initCommands,
    p2pConfig,
    startCommands,
    stateSyncConfig,
    versionCommand
} from "./RunNodeGuide";

const GUIDE = {
    chainVersion: "0.1.73",
    seeds: "abc123@node1.block52.xyz:26656,def456@node.texashodl.net:26656",
    rpcServers: "https://node1.block52.xyz/rpc/,https://node.texashodl.net/rpc/",
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

    it("initCommands download the official genesis from the mirror and verify its sha256 (#102)", () => {
        const out = initCommands();
        expect(out).toContain("pokerchaind init <your-moniker> --chain-id pokerchain --home ~/.pokerchain");
        // The mirror URL, not a node's own /genesis (which hashes differently).
        expect(out).toContain(`curl -fSL "${GENESIS_URL}" -o ~/.pokerchain/config/genesis.json`);
        // The check compares against the built-in sha, so it actually verifies something.
        expect(out).toContain(`echo "${GENESIS_SHA256}  ~/.pokerchain/config/genesis.json" | sha256sum -c -`);
        expect(GENESIS_URL).toContain("pokerchain-releases");
    });

    it("p2pConfig renders seeds, persistent peers and RPC CORS for the app (#102)", () => {
        const out = p2pConfig(GUIDE.seeds);
        expect(out).toContain(`seeds = "${GUIDE.seeds}"`);
        expect(out).toContain(`persistent_peers = "${GUIDE.seeds}"`);
        expect(out).toContain("[rpc]");
        expect(out).toContain("cors_allowed_origins = [\"*\"]");
    });

    it("stateSyncConfig renders live trust values", () => {
        const out = stateSyncConfig(GUIDE.rpcServers, GUIDE.trustHeight, GUIDE.trustHash);
        expect(out).toContain("enable = true");
        expect(out).toContain(`rpc_servers = "${GUIDE.rpcServers}"`);
        expect(out).toContain(`trust_height = ${GUIDE.trustHeight}`);
        expect(out).toContain(`trust_hash = "${GUIDE.trustHash}"`);
    });

    it("appToml renders the engine under [pvm] and enables the REST API for the app (#102)", () => {
        const out = appToml();
        expect(out).toContain("minimum-gas-prices = \"0usdc\"");
        expect(out).toContain("snapshot-interval = 1000");
        // The engine must be under [pvm], not an [engine] section — otherwise the node panics at startup.
        expect(out).toContain("[pvm]");
        expect(out).toContain("pvm_url = \"\"");
        expect(out).toContain("embedded_engine = \"embedded\"");
        // No [engine] section header (it may appear only in an explanatory comment).
        expect(out.split("\n").some(line => line.trim() === "[engine]")).toBe(false);
        // REST API on (init leaves it off) so the app can use the node on Localhost.
        expect(out).toContain("[api]");
        expect(out).toContain("enable = true");
        expect(out).toContain("enabled-unsafe-cors = true");
    });

    it("appToml keeps ~two weeks of history for the explorer and hand replay (#111)", () => {
        const out = appToml();
        // State (hand replay) and blocks (explorer) both retained for ~226,000 blocks ≈ 14 days.
        expect(out).toContain("pruning = \"custom\"");
        expect(out).toContain("pruning-keep-recent = \"226000\"");
        expect(out).toContain("pruning-interval = \"10\"");
        expect(out).toContain("min-retain-blocks = 226000");
    });

    it("buildSeeds joins node ids at the default p2p port", () => {
        expect(buildSeeds([{ host: "node1.block52.xyz", nodeId: "abc123" }, { host: "node2.block52.xyz", nodeId: null }])).toBe(
            "abc123@node1.block52.xyz:26656"
        );
    });

    it("startCommands start the node", () => {
        expect(startCommands()).toContain("pokerchaind start --home ~/.pokerchain");
    });
});

describe("RunNodeGuide", () => {
    it("renders all four steps with copyable code blocks", () => {
        render(
            <ToastProvider>
                <RunNodeGuide {...GUIDE} />
            </ToastProvider>
        );

        expect(screen.getByText(/Install pokerchain 0\.1\.73/)).toBeTruthy();
        expect(screen.getByText(/Initialise the home dir and install the genesis/)).toBeTruthy();
        expect(screen.getByText(/Peers, discovery and state sync/)).toBeTruthy();
        expect(screen.getByText(/Start and wait for sync/)).toBeTruthy();

        // one copy button per code block (6 blocks)
        expect(screen.getAllByRole("button", { name: "Copy" }).length).toBe(6);
        expect(screen.getByText(/trust_hash = "A1B2C3HASH"/)).toBeTruthy();
    });
});
