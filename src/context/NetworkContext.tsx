import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import { discoverNetworks } from "../utils/networkDiscovery";

/**
 * NetworkEndpoints describes all endpoints for a given network.
 * - name: Display name for the network
 * - rpc: Tendermint RPC endpoint (HTTP/S)
 * - rest: Cosmos REST API endpoint
 * - grpc: Cosmos gRPC endpoint
 * - ws: WebSocket endpoint for real-time table/game updates (used by UI)
 */
export interface NetworkEndpoints {
    name: string;
    rpc: string;
    rest: string;
    grpc: string;
    ws: string;
}

// TODO: Dynamic endpoint discovery from validators API
// Future enhancement: Fetch validators from /cosmos/staking/v1beta1/validators
// and dynamically build network list from validator metadata.
// Example:
//   curl -s https://block52.xyz/cosmos/staking/v1beta1/validators | jq
//   Extract validator monikers ("block52", "texashodl") and map to REST endpoints
//   This would allow automatic network discovery without hardcoding endpoints
//
// NETWORK ENDPOINT PATTERN (Reverse Proxy with Path-based Routing):
// ==================================================================
// Each validator domain uses path-based routing instead of subdomains:
//
//   Base Domain: https://block52.xyz
//   ├── REST API:  https://block52.xyz/          (Cosmos SDK REST, port 1317 proxied)
//   ├── RPC:       https://block52.xyz/rpc/      (Tendermint RPC, port 26657 proxied)
//   └── gRPC:      grpcs://block52.xyz:9443      (gRPC with TLS)
//
// Benefits:
//   - Single domain with SSL certificate
//   - CORS configured at reverse proxy level
//   - Cleaner URLs without subdomain proliferation
//   - Easy to add new endpoints as paths
//
// Same pattern applies to all validator domains (block52.xyz, texashodl.net, etc.)
//
// NETWORK STATUS (Last tested: 2026-03-23):
// ✅ Block52 (node1.block52.xyz) - Official production node (first-run fallback when no local node answers)
// ✅ Localhost - Works with `ignite chain serve`
// ✅ Texas Hodl (node.texashodl.net) - Working, use for production testing
//
// CLI TEST COMMANDS (run in terminal to verify endpoints):
//
// Test Localhost (when ignite chain serve is running):
//   curl -s http://localhost:26657/status | jq '.result.sync_info.latest_block_height'
//
// Test Block52:
//   curl -s --max-time 10 https://node1.block52.xyz/cosmos/base/tendermint/v1beta1/node_info | jq '.default_node_info.moniker'
//
// Test Texas Hodl:
//   curl -s https://node.texashodl.net/cosmos/base/tendermint/v1beta1/node_info | jq '.default_node_info.moniker'
//   curl -s https://node.texashodl.net/cosmos/base/tendermint/v1beta1/blocks/latest | jq '.block.header.height'
//
/**
 * NETWORK_PRESETS
 *
 * Each network entry includes endpoints for RPC, REST, gRPC, and WebSocket (ws).
 * The ws property is used by the UI for real-time table/game updates.
 *
 * WebSocket Server Architecture:
 *   - Runs on port 8585 (separate from Tendermint RPC on 26657)
 *   - Subscribes to Tendermint events and broadcasts to UI clients
 *   - Production: nginx proxies /ws path to localhost:8585
 *
 * Example ws usage:
 *   ws://localhost:8585/ws (local development)
 *   wss://node.texashodl.net/ws (production via nginx proxy)
 */
export const NETWORK_PRESETS: NetworkEndpoints[] = [
    // [0] ✅ Block52 - Official node (first-run fallback; a reachable local pokerchain node is preferred)
    // Using HTTPS endpoints via NGINX reverse proxy to avoid mixed content errors
    // NOTE: /rpc/ requires trailing slash due to nginx location block configuration
    {
        name: "Block52",
        rpc: "https://node1.block52.xyz/rpc/",
        rest: "https://node1.block52.xyz",
        grpc: "grpcs://node1.block52.xyz:9443",
        ws: "wss://node1.block52.xyz/ws" // WebSocket endpoint for table/game updates
    },
    // [1] ✅ Localhost - Default for local development with `ignite chain serve`
    {
        name: "Localhost",
        rpc: "http://localhost:26657",
        rest: "http://localhost:1317",
        grpc: "http://localhost:9090",
        ws: "ws://localhost:8585/ws" // WebSocket server for real-time game updates (port 8585)
    },
    // [2] ✅ Texas Hodl - Recommended for production testing
    {
        name: "Texas Hodl",
        rpc: "https://node.texashodl.net/rpc/",
        rest: "https://node.texashodl.net",
        grpc: "grpcs://node.texashodl.net:9443",
        ws: "wss://node.texashodl.net/ws" // WebSocket endpoint for table/game updates
    },
    // [3] ✅ Miller Services - Sync node on DigitalOcean SYD1
    // Added: 2025-12-22
    {
        name: "Miller Services",
        rpc: "https://node.tommillerservices.com/rpc/",
        rest: "https://node.tommillerservices.com",
        grpc: "grpcs://node.tommillerservices.com:9443",
        ws: "wss://node.tommillerservices.com/ws" // WebSocket server not deployed yet
    },
    // [4] 🧪 Wallet Stub - Local @block52/wallet-stub server
    // Serves a funded balance + synthetic game state so the UI runs with no chain/funds.
    // Run: `yarn stub`. Gameplay actions/WS use this network's rpc/ws endpoints.
    {
        name: "Stub",
        rpc: "http://localhost:8546",
        rest: "http://localhost:8546",
        grpc: "http://localhost:8546",
        ws: "ws://localhost:8546/ws"
    }
];

interface NetworkContextType {
    currentNetwork: NetworkEndpoints;
    setNetwork: (network: NetworkEndpoints) => void;
    availableNetworks: NetworkEndpoints[];
    discoveredNetworks: NetworkEndpoints[];
    addDiscoveredNetwork: (network: NetworkEndpoints) => void;
    removeDiscoveredNetwork: (name: string) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

const DISCOVERED_NETWORKS_KEY = "discoveredNetworks";

/** How often to re-scan the selected node's validator set for new nodes. */
const DISCOVERY_POLL_MS = 5 * 60 * 1000;

export const NetworkProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Initialize network from localStorage. A saved choice always wins. On a first
    // run we start on Block52 and let the probe below upgrade to Localhost if a
    // local pokerchain node is reachable.
    const [currentNetwork, setCurrentNetwork] = useState<NetworkEndpoints>(() => {
        const saved = localStorage.getItem("selectedNetwork");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Validate that the parsed object has the ws property (for backward compatibility)
                if (!parsed.ws) {
                    return NETWORK_PRESETS[0]; // Block52 (probe may switch to Localhost)
                }
                return parsed;
            } catch {
                // Corrupted value — treat as a first run.
                return NETWORK_PRESETS[0];
            }
        }
        return NETWORK_PRESETS[0];
    });

    // Initialize discovered networks from localStorage
    const [discoveredNetworks, setDiscoveredNetworks] = useState<NetworkEndpoints[]>(() => {
        const saved = localStorage.getItem(DISCOVERED_NETWORKS_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                return [];
            }
        }
        return [];
    });

    // Save to localStorage whenever network changes
    useEffect(() => {
        localStorage.setItem("selectedNetwork", JSON.stringify(currentNetwork));
    }, [currentNetwork]);

    // First run only: prefer a local pokerchain node when one is actually running,
    // otherwise stay on Block52 (so a packaged build with no local chain doesn't
    // start on a node that never answers). A choice the user already saved skips
    // this — a first run is "nothing saved, or a legacy value with no ws".
    useEffect(() => {
        const saved = localStorage.getItem("selectedNetwork");
        let isFirstRun = saved === null;
        if (saved !== null) {
            try {
                isFirstRun = !(JSON.parse(saved) as { ws?: unknown }).ws;
            } catch {
                isFirstRun = true;
            }
        }
        if (!isFirstRun) return;

        const localhost = NETWORK_PRESETS.find(p => p.name === "Localhost");
        if (localhost === undefined) return;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        void fetch(`${localhost.rest}/cosmos/base/tendermint/v1beta1/node_info`, { signal: controller.signal })
            .then(res => (res.ok ? res.json() : null))
            .then(info => {
                const network = (info as { default_node_info?: { network?: unknown } } | null)?.default_node_info?.network;
                // Switch only if the local node is up and reports the pokerchain, and
                // the user hasn't picked something else since mount.
                if (network === COSMOS_CONSTANTS.CHAIN_ID && localStorage.getItem("selectedNetwork") === JSON.stringify(NETWORK_PRESETS[0])) {
                    setCurrentNetwork(localhost);
                }
            })
            .catch(() => undefined) // no local node: stay on Block52
            .finally(() => clearTimeout(timer));
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
        // Runs once on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Save discovered networks to localStorage
    useEffect(() => {
        localStorage.setItem(DISCOVERED_NETWORKS_KEY, JSON.stringify(discoveredNetworks));
    }, [discoveredNetworks]);

    // Automatic node discovery (#73): from the selected node's validator set, find
    // other pokerchain nodes and add the verified ones to "Discovered". Read-only;
    // the user still picks, and a node they picked is kept over anything found.
    useEffect(() => {
        if (currentNetwork.rest === "") return;
        const controller = new AbortController();
        const run = async () => {
            const known = [...NETWORK_PRESETS, ...discoveredNetworks];
            const found = await discoverNetworks(currentNetwork.rest, known, fetch, controller.signal);
            if (!controller.signal.aborted) found.forEach(addDiscoveredNetwork);
        };
        void run();
        const timer = setInterval(() => void run(), DISCOVERY_POLL_MS);
        return () => {
            controller.abort();
            clearInterval(timer);
        };
        // Re-run when the selected network changes. addDiscoveredNetwork de-dupes,
        // so re-reading the current discovered list each run is enough.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentNetwork.rest]);

    const setNetwork = (network: NetworkEndpoints) => {
        setCurrentNetwork(network);
    };

    const addDiscoveredNetwork = (network: NetworkEndpoints) => {
        setDiscoveredNetworks(prev => {
            // Avoid duplicates by name
            if (prev.some(n => n.name === network.name)) {
                return prev;
            }
            // Also check if it matches a preset
            if (NETWORK_PRESETS.some(p => p.name === network.name || p.rest === network.rest)) {
                return prev;
            }
            return [...prev, network];
        });
    };

    const removeDiscoveredNetwork = (name: string) => {
        setDiscoveredNetworks(prev => prev.filter(n => n.name !== name));
    };

    return (
        <NetworkContext.Provider
            value={{
                currentNetwork,
                setNetwork,
                availableNetworks: NETWORK_PRESETS,
                discoveredNetworks,
                addDiscoveredNetwork,
                removeDiscoveredNetwork
            }}
        >
            {children}
        </NetworkContext.Provider>
    );
};

export const useNetwork = (): NetworkContextType => {
    const context = useContext(NetworkContext);
    if (!context) {
        throw new Error("useNetwork must be used within a NetworkProvider");
    }
    return context;
};
