// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ToastProvider } from "../../context/ToastContext";
import RunNodeGuide, {
    appToml,
    buildSeeds,
    initCommands,
    p2pConfig,
    startCommands,
    stateSyncConfig,
    versionCommand
} from "./RunNodeGuide";

const GUIDE = {
    chainVersion: "0.1.73",
    genesisUrl: "https://node1.block52.xyz/genesis",
    seeds: "abc123@node1.block52.xyz:26656,def456@node.texashodl.net:26656",
    rpcServers: "http://node1.block52.xyz:26657,http://node.texashodl.net:26657",
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

    it("initCommands init the home dir and install genesis", () => {
        const out = initCommands(GUIDE.genesisUrl);
        expect(out).toContain("pokerchaind init <your-moniker> --chain-id pokerchain --home ~/.pokerchain");
        expect(out).toContain(`curl -fSL "${GUIDE.genesisUrl}" -o ~/.pokerchain/config/genesis.json`);
        expect(out).toContain("sha256sum ~/.pokerchain/config/genesis.json");
    });

    it("p2pConfig renders seeds and persistent peers", () => {
        const out = p2pConfig(GUIDE.seeds);
        expect(out).toContain(`seeds = "${GUIDE.seeds}"`);
        expect(out).toContain(`persistent_peers = "${GUIDE.seeds}"`);
    });

    it("stateSyncConfig renders live trust values", () => {
        const out = stateSyncConfig(GUIDE.rpcServers, GUIDE.trustHeight, GUIDE.trustHash);
        expect(out).toContain("enable = true");
        expect(out).toContain(`rpc_servers = "${GUIDE.rpcServers}"`);
        expect(out).toContain(`trust_height = ${GUIDE.trustHeight}`);
        expect(out).toContain(`trust_hash = "${GUIDE.trustHash}"`);
    });

    it("appToml renders pruning and engine settings", () => {
        const out = appToml();
        expect(out).toContain("minimum-gas-prices = \"0usdc\"");
        expect(out).toContain("snapshot-interval = 1000");
        expect(out).toContain("embedded_engine = \"embedded\"");
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
