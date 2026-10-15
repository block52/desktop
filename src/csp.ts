/**
 * The renderer holds the wallet seed phrase, so the Content-Security-Policy decides where a script that
 * somehow ran could send it. `connect-src` therefore lists the exact services the app talks to rather than
 * every https host.
 */

const BLOCK52_NODES = [
    "https://*.block52.xyz",
    "wss://*.block52.xyz",
    "https://block52.xyz",
    "https://node.texashodl.net",
    "wss://node.texashodl.net",
    "https://node.tommillerservices.com",
    "wss://node.tommillerservices.com"
];

const APP_SERVICES = [
    "https://poker-vm-proxy-js-ixe4h.ondigitalocean.app",
    "https://raw.githubusercontent.com"
];

// WalletConnect / Reown AppKit and the Coinbase wallet option. Listed host by host so their analytics
// endpoints (pulse.walletconnect.org, cca-lite.coinbase.com) stay blocked.
const WALLET_CONNECT = [
    "https://rpc.walletconnect.org",
    "https://verify.walletconnect.org",
    "https://verify.walletconnect.com",
    "wss://relay.walletconnect.org",
    "wss://relay.walletconnect.com",
    "https://api.web3modal.org",
    "https://keys.coinbase.com",
    "https://rpc.wallet.coinbase.com"
];

// WalletConnect Verify checks the app's origin through a hidden frame on these two hosts only.
const WALLET_CONNECT_FRAMES = ["https://verify.walletconnect.org", "https://verify.walletconnect.com"];

// Ethereum RPC used by wagmi/viem for reads (balances, allowances, receipts).
const ETHEREUM_RPC = ["https://eth.merkle.io"];

const LOCAL_DEVELOPMENT = ["ws://localhost:*", "wss://localhost:*", "http://localhost:*"];

/** Hosts read from build-time settings (indexer, payment proxy, schedule, NFT sources). */
export function hostsFromUrls(urls: Array<string | undefined>): string[] {
    const hosts: string[] = [];
    for (const value of urls) {
        if (value === undefined || value.trim() === "") continue;
        try {
            const url = new URL(value.replace(/\{[^}]*\}/g, "x"));
            if (url.protocol === "https:") hosts.push(url.origin, `wss://${url.host}`);
        } catch {
            // an unparsable setting simply adds nothing
        }
    }
    return hosts;
}

export function buildContentSecurityPolicy(options: { isDev: boolean; extraConnectHosts: string[] }): string {
    // WebAssembly is allowed for bundled libraries (libsodium); inline script and eval are not.
    const scriptSrc = options.isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'wasm-unsafe-eval'";
    const connectSrc = [
        "'self'",
        ...LOCAL_DEVELOPMENT,
        ...BLOCK52_NODES,
        ...APP_SERVICES,
        ...WALLET_CONNECT,
        ...ETHEREUM_RPC,
        ...options.extraConnectHosts
    ].join(" ");

    return [
        "default-src 'self'",
        `script-src ${scriptSrc}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data: https:",
        `connect-src ${connectSrc}`,
        `frame-src ${WALLET_CONNECT_FRAMES.join(" ")}`,
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
        "frame-ancestors 'none'"
    ].join("; ");
}
