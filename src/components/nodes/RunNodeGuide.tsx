import { CopyButton } from "@block52/ui-sdk";
import styles from "./RunNodeGuide.module.css";

export interface RunNodeGuideProps {
    chainVersion: string;
    seeds: string;
    rpcServers: string;
    trustHeight: string;
    trustHash: string;
}

/* ── Command/config builders (unit-tested) ── */

export function versionCommand(): string {
    return "pokerchaind version";
}

// The official genesis from the public mirror, with its SHA-256 built into the app so
// the integrity check doesn't trust the file it just downloaded. A node's own /genesis
// (REST 501, or RPC's reordered consensus_params) hashes differently and replays to a
// wrong AppHash around block 150 — see pokerchain's GENESIS.md. Issue #102.
export const GENESIS_URL = "https://raw.githubusercontent.com/block52/pokerchain-releases/main/networks/pokerchain/genesis.json";
export const GENESIS_SHA256 = "ae808c4889f1c520c92f40d55dd984d41fec7a03b0373170dcafdeeaf1454731";

export function initCommands(): string {
    return [
        "pokerchaind init <your-moniker> --chain-id pokerchain --home ~/.pokerchain",
        `curl -fSL "${GENESIS_URL}" -o ~/.pokerchain/config/genesis.json`,
        // sha256sum -c opens the path it reads literally, and ~ inside quotes isn't expanded: check from the directory.
        "# must print \"genesis.json: OK\" (macOS: use shasum -a 256 -c - instead of sha256sum -c -)",
        `(cd ~/.pokerchain/config && echo "${GENESIS_SHA256}  genesis.json" | sha256sum -c -)`
    ].join("\n");
}

export function p2pConfig(seeds: string): string {
    return [
        "# ~/.pokerchain/config/config.toml",
        "[p2p]",
        `seeds = "${seeds}"`,
        `persistent_peers = "${seeds}"`,
        "external_address = \"<your-public-ip>:26656\"   # if reachable from the Internet",
        "",
        "# Let the Block52 desktop app's RPC calls through (RPC only listens on 127.0.0.1).",
        "[rpc]",
        "cors_allowed_origins = [\"*\"]"
    ].join("\n");
}

export function stateSyncConfig(rpcServers: string, trustHeight: string, trustHash: string): string {
    return [
        "[statesync]",
        "enable = true",
        `rpc_servers = "${rpcServers}"`,
        `trust_height = ${trustHeight}`,
        `trust_hash = "${trustHash}"`,
        "trust_period = \"168h0m\""
    ].join("\n");
}

// Two weeks of history at the chain's ~5.35s blocks ≈ 226,000 blocks. Keeping that
// much lets the block explorer and hand replay work on a local node for recent play:
//   - min-retain-blocks keeps the blocks themselves (block explorer, reads by height)
//   - pruning-keep-recent keeps app state at past heights (hand replay queries state
//     at the hand's end height)
// History only builds up while the node runs — a freshly state-synced node starts with
// just current state and reaches two weeks after running that long; older history comes
// from the indexer. ~1.1 GB of blocks for the window at today's activity (the tx index
// grows unbounded on top of that, ~10 GB/year). See issue #111.
const TWO_WEEK_BLOCKS = 226000;

export function appToml(): string {
    return [
        "# ~/.pokerchain/config/app.toml",
        "minimum-gas-prices = \"0usdc\"",
        "",
        "# Keep ~two weeks of history for the block explorer and hand replay (issue #111).",
        "pruning = \"custom\"",
        `pruning-keep-recent = "${TWO_WEEK_BLOCKS}"`,
        "pruning-interval = \"10\"",
        `min-retain-blocks = ${TWO_WEEK_BLOCKS}`,
        "",
        "[state-sync]",
        "snapshot-interval = 1000",
        "snapshot-keep-recent = 2",
        "",
        "# Serve the Block52 desktop app on this node (its Localhost network).",
        "# init leaves the REST API off; CORS lets the app (another origin) call it.",
        "[api]",
        "enable = true",
        "enabled-unsafe-cors = true",
        "",
        "# Run the poker engine in-process. pokerchaind reads pvm.embedded_engine; under",
        "# [engine] it is ignored and the node panics at startup with pvm_url unset.",
        "[pvm]",
        "pvm_url = \"\"",
        "embedded_engine = \"embedded\""
    ].join("\n");
}

export function startCommands(): string {
    return [
        "pokerchaind start --home ~/.pokerchain",
        "# in another shell; done when this prints false:",
        "curl -s localhost:26657/status | jq .result.sync_info.catching_up"
    ].join("\n");
}

export interface SeedNode {
    host: string;
    nodeId: string | null;
}

/** "<nodeId>@<host>:26656" entries for every node that reported an id. */
export function buildSeeds(nodes: SeedNode[]): string {
    return nodes
        .filter((n): n is { host: string; nodeId: string } => n.nodeId !== null)
        .map(n => `${n.nodeId}@${n.host}:26656`)
        .join(",");
}

/** A node on this machine: never a peer or state-sync server for a new node. */
export function isLoopbackUrl(url: string): boolean {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "[::1]" || host.startsWith("127.");
}

/* ── UI ── */

interface CodeBlockProps {
    label: string;
    code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ label, code }) => (
    <div className={styles.codeBlock}>
        <div className={styles.codeHead}>
            <span className={styles.codeLabel}>{label}</span>
            <CopyButton text={code} message="Copied" title="Copy" />
        </div>
        <pre className={styles.code}>{code}</pre>
    </div>
);

interface StepCardProps {
    step: number;
    title: string;
    children: React.ReactNode;
}

const StepCard: React.FC<StepCardProps> = ({ step, title, children }) => (
    <div className={`pane-lite ${styles.card}`}>
        <div className={styles.cardTitle}>
            <span className={styles.stepNumber}>{step}.</span>
            <h2 className={styles.title}>{title}</h2>
        </div>
        {children}
    </div>
);

const RunNodeGuide: React.FC<RunNodeGuideProps> = ({ chainVersion, seeds, rpcServers, trustHeight, trustHash }) => (
    <div className={styles.guide}>
        <StepCard step={1} title={`Install pokerchain ${chainVersion}`}>
            <p className={styles.text}>
                Run exactly the version the validators run ({chainVersion}). A different binary computes different
                state and halts with an AppHash mismatch. Releases ship from the block52/pokerchain GitHub releases.
            </p>
            <CodeBlock label="Check" code={versionCommand()} />
        </StepCard>

        <StepCard step={2} title="Initialise the home dir and install the genesis">
            <p className={styles.text}>
                Download the official genesis from the public mirror and check it against the SHA-256 the app has
                built in. Don&apos;t use a node&apos;s own genesis — it hashes differently and replays to a wrong
                AppHash early in the chain.
            </p>
            <CodeBlock label="Shell" code={initCommands()} />
        </StepCard>

        <StepCard step={3} title="Peers, discovery and state sync">
            <p className={styles.text}>
                Bootstrap from the seed nodes and let PEX find the rest; never make a single node your only peer.
                State sync fetches a recent snapshot instead of replaying from genesis, which doesn't work across
                the chain's past upgrades. The trust point below is read live from the chain.
            </p>
            <p className={styles.text}>
                The pruning settings in <code>app.toml</code> keep about two weeks of history, so the block explorer
                and hand replay work on your node for recent play. History builds up while the node runs — a freshly
                synced node starts empty and reaches two weeks after running that long; older history comes from the
                indexer. Budget roughly 1&nbsp;GB for the window (the transaction index keeps growing on top of that).
            </p>
            <p className={styles.text}>
                The <code>[api]</code> and <code>[rpc]</code> blocks let the app reach this node on its{" "}
                <em>Localhost</em> network: <code>init</code> leaves the REST API off, and REST and RPC only listen on
                localhost, so the app (a different origin) needs CORS. The in-process engine (<code>[pvm]</code>) and
                the built-in WebSocket relay on <code>:8585</code> mean no extra services to run.
            </p>
            <CodeBlock label="config.toml" code={p2pConfig(seeds)} />
            <CodeBlock label="config.toml" code={stateSyncConfig(rpcServers, trustHeight, trustHash)} />
            <CodeBlock label="app.toml" code={appToml()} />
        </StepCard>

        <StepCard step={4} title="Start and wait for sync">
            <CodeBlock label="Shell" code={startCommands()} />
        </StepCard>
    </div>
);

export default RunNodeGuide;
