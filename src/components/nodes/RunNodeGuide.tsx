import { CopyButton } from "@block52/ui-sdk";
import styles from "./RunNodeGuide.module.css";

export interface RunNodeGuideProps {
    chainVersion: string;
    seeds: string;
    /** State-sync RPC servers; the light client needs at least two. */
    rpcServers: string[];
    trustHeight: string;
    trustHash: string;
}

/**
 * The network's official genesis, from the public release mirror, pinned to the commit that added it
 * (block52/pokerchain-releases#1). A node's own RPC `/genesis` is the same chain in CometBFT's flat layout:
 * its hash differs, and a node replaying from genesis with it fails with a wrong AppHash.
 */
const GENESIS_URL =
    "https://raw.githubusercontent.com/block52/pokerchain-releases/05fb0712b3d25b8b7c5a1be70d370405897a681f/networks/pokerchain/genesis.json";
/** Built into the app, so the check doesn't rely on the server the file came from. */
const GENESIS_SHA256 = "ae808c4889f1c520c92f40d55dd984d41fec7a03b0373170dcafdeeaf1454731";

/** The light client checks the primary against at least one witness. */
const MIN_STATE_SYNC_SERVERS = 2;

/* ── Command/config builders (unit-tested) ── */

export function versionCommand(): string {
    return "pokerchaind version";
}

export function initCommands(): string {
    return [
        "pokerchaind init <your-moniker> --chain-id pokerchain --home ~/.pokerchain",
        `curl -fSL "${GENESIS_URL}" -o ~/.pokerchain/config/genesis.json`,
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
        "external_address = \"<your-public-ip>:26656\"   # if reachable from the Internet"
    ].join("\n");
}

export function stateSyncConfig(rpcServers: string[], trustHeight: string, trustHash: string): string {
    return [
        "[statesync]",
        "enable = true",
        `rpc_servers = "${rpcServers.join(",")}"`,
        `trust_height = ${trustHeight}`,
        `trust_hash = "${trustHash}"`,
        "trust_period = \"168h0m\""
    ].join("\n");
}

export function appToml(): string {
    return [
        "# ~/.pokerchain/config/app.toml",
        "minimum-gas-prices = \"0usdc\"",
        "",
        "[state-sync]",
        "snapshot-interval = 1000",
        "snapshot-keep-recent = 2",
        "",
        "# the existing [pvm] section: run the poker engine inside the node",
        "[pvm]",
        "pvm_url = \"\"",
        "embedded_engine = \"embedded\""
    ].join("\n");
}

/** REST API and CORS so this app can use the node as its Localhost network. Both stay on localhost. */
export function localAppConfig(): string {
    return [
        "# ~/.pokerchain/config/app.toml",
        "[api]",
        "enable = true",
        "enabled-unsafe-cors = true",
        "",
        "# ~/.pokerchain/config/config.toml",
        "[rpc]",
        "cors_allowed_origins = [\"*\"]"
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
                state and halts with an AppHash mismatch. Download it under Node software above, or from the
                block52/pokerchain-releases GitHub releases.
            </p>
            <CodeBlock label="Check" code={versionCommand()} />
        </StepCard>

        <StepCard step={2} title="Initialise the home dir and install the genesis">
            <p className={styles.text}>
                The official genesis comes from the public block52/pokerchain-releases repository, and its SHA-256 is
                built into this app. Only use the file if the check prints OK. Don&apos;t use a node&apos;s own
                /genesis instead: it is laid out differently, so its hash won&apos;t match.
            </p>
            <CodeBlock label="Shell" code={initCommands()} />
        </StepCard>

        <StepCard step={3} title="Peers, discovery and state sync">
            <p className={styles.text}>
                Bootstrap from the seed nodes and let PEX find the rest; never make a single node your only peer.
                State sync fetches a recent snapshot instead of replaying from genesis, which doesn&apos;t work across
                the chain&apos;s past upgrades. The trust point below is read live from the chain, and the RPC servers
                are the nodes that answered just now.
            </p>
            {rpcServers.length < MIN_STATE_SYNC_SERVERS && (
                <p className={styles.warning} role="alert">
                    State sync needs at least {MIN_STATE_SYNC_SERVERS} RPC servers, and only {rpcServers.length} answered.
                    Add another node&apos;s RPC address to rpc_servers before starting.
                </p>
            )}
            <CodeBlock label="config.toml" code={p2pConfig(seeds)} />
            <CodeBlock label="config.toml" code={stateSyncConfig(rpcServers, trustHeight, trustHash)} />
            <CodeBlock label="app.toml" code={appToml()} />
        </StepCard>

        <StepCard step={4} title="Let this app use the node">
            <p className={styles.text}>
                Turns on the REST API and lets this app call it. Both listen on localhost only. gRPC is on by default,
                and the node serves table updates on ws://localhost:8585/ws itself. Once it has caught up, pick
                Localhost on the Nodes tab.
            </p>
            <CodeBlock label="app.toml + config.toml" code={localAppConfig()} />
        </StepCard>

        <StepCard step={5} title="Start and wait for sync">
            <p className={styles.text}>The node log should show engine_mode=embedded.</p>
            <CodeBlock label="Shell" code={startCommands()} />
        </StepCard>
    </div>
);

export default RunNodeGuide;
