import CopyButton from "../copyButton/CopyButton";
import styles from "./RunNodeGuide.module.css";

export interface RunNodeGuideProps {
    chainVersion: string;
    genesisUrl: string;
    seeds: string;
    rpcServers: string;
    trustHeight: string;
    trustHash: string;
}

/* ── Command/config builders (unit-tested) ── */

export function versionCommand(): string {
    return "pokerchaind version";
}

export function initCommands(genesisUrl: string): string {
    return [
        "pokerchaind init <your-moniker> --chain-id pokerchain --home ~/.pokerchain",
        `curl -fSL "${genesisUrl}" -o ~/.pokerchain/config/genesis.json`,
        "sha256sum ~/.pokerchain/config/genesis.json"
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

export function appToml(): string {
    return [
        "# ~/.pokerchain/config/app.toml",
        "minimum-gas-prices = \"0usdc\"",
        "",
        "[state-sync]",
        "snapshot-interval = 1000",
        "snapshot-keep-recent = 2",
        "",
        "[engine]",
        "embedded_engine = \"embedded\""
    ].join("\n");
}

export function startCommands(): string {
    return [
        "pokerchaind start --home ~/.pokerchain",
        "# in another shell: done when catching_up is false"
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

const RunNodeGuide: React.FC<RunNodeGuideProps> = ({ chainVersion, genesisUrl, seeds, rpcServers, trustHeight, trustHash }) => (
    <div className={styles.guide}>
        <StepCard step={1} title={`Install pokerchain ${chainVersion}`}>
            <p className={styles.text}>
                Run exactly the version the validators run ({chainVersion}). A different binary computes different
                state and halts with an AppHash mismatch. Releases ship from the block52/pokerchain GitHub releases.
            </p>
            <CodeBlock label="Check" code={versionCommand()} />
        </StepCard>

        <StepCard step={2} title="Initialise the home dir and install the genesis">
            <CodeBlock label="Shell" code={initCommands(genesisUrl)} />
        </StepCard>

        <StepCard step={3} title="Peers, discovery and state sync">
            <p className={styles.text}>
                Bootstrap from the seed nodes and let PEX find the rest; never make a single node your only peer.
                State sync fetches a recent snapshot instead of replaying from genesis, which doesn't work across
                the chain's past upgrades. The trust point below is read live from the chain.
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
