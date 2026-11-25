export interface VaultStatus {
    /** A wallet is saved. */
    exists: boolean;
    locked: boolean;
    hasPassword: boolean;
    touchIdEnabled: boolean;
    /** 0 means never. */
    autoLockMinutes: number;
    /** The PGP key (fingerprint) that can also unlock the wallet, or null. */
    pgpFingerprint: string | null;
    /** False when the OS can only obfuscate (a Linux machine without a keyring), so the seed is not truly protected. */
    osProtected: boolean;
}

export interface WalletStatus extends VaultStatus {
    touchIdAvailable: boolean;
    /** GnuPG is installed, so a PGP key can be used. */
    pgpAvailable: boolean;
}

/** The only SDK signing-client methods the page may invoke. */
export const SIGNING_METHODS = [
    "sendTokens",
    "createGame",
    "joinGame",
    "leaveGame",
    "recordHandEnd",
    "deleteGame",
    "forceCloseGame",
    "performActionSync",
    "topUp",
    "initiateWithdrawal",
    "listWithdrawalRequests",
    "registerNftAvatar",
    "createValidator",
    "registerTournament",
] as const;

export type SigningMethod = (typeof SIGNING_METHODS)[number];

/** The tokens the Ethereum deposit address can send to the bridge. */
export const ETH_DEPOSIT_TOKENS = ["USDC", "USDT"] as const;

export type EthDepositToken = (typeof ETH_DEPOSIT_TOKENS)[number];

/** What the Ethereum deposit address holds, in each asset's smallest unit (wei, or 6 or 8 decimals). */
export interface EthBalances {
    eth: bigint;
    usdc: bigint;
    usdt: bigint;
    wbtc: bigint;
}

export interface EthDepositResult {
    /** Null when the bridge already had enough allowance. */
    approveHash: string | null;
    depositHash: string;
}

export interface SignerNetwork {
    rpc: string;
    rest: string;
    /** The node's gRPC endpoint. Needed when a method is signed in the Go sidecar. */
    grpc?: string;
}

/** A key a key server returned. It is only a suggestion until the user has checked the fingerprint. */
export interface FoundPgpKey {
    armored: string;
    fingerprint: string;
    server: string;
}

export type WalletCredential = { password: string } | { touchId: true } | { pgp: true };

/** A game action signed and broadcast in Go. Amounts are micro-USDC as numbers (within JS safe-int range). */
export interface BroadcastActionParams {
    kind: "action" | "join" | "leave" | "topUp";
    gameId: string;
    action?: string;
    amount?: number;
    data?: string;
    seat?: number;
    buyIn?: number;
    /** A Sit & Go claim: player addresses, place 1 first, so the chain can work out payouts (leave only). */
    finishingOrder?: string[];
}

/** What the preload script exposes to the page. The seed phrase only leaves the main process through `getMnemonic`. */
export interface WalletBridge {
    status: () => Promise<WalletStatus>;
    unlock: (credential: WalletCredential) => Promise<boolean>;
    /** Re-checks a credential for a sensitive action (revealing the seed) without changing the lock state. */
    authenticate: (credential: WalletCredential) => Promise<boolean>;
    lock: () => Promise<void>;
    /** The address of the saved wallet, derived in the main process. */
    getAddress: () => Promise<string>;
    /** Makes a new wallet, saves it, and returns its seed phrase once so it can be written down. */
    generate: () => Promise<{ mnemonic: string; address: string }>;
    /** Saves a seed phrase the user typed in and returns the wallet address. */
    importMnemonic: (mnemonic: string) => Promise<string>;
    /** Needs `authenticate` to have succeeded just before when a password is set; otherwise asks in a native dialog. */
    revealMnemonic: () => Promise<string | null>;
    /** Signs the table-subscription message `pokerchain-query:<timestamp>`. */
    signQuery: (timestamp: number) => Promise<string>;
    /** Signs and broadcasts a game action (performAction/join/leave/topUp) in Go as an ordered tx over gRPC. */
    broadcastAction: (grpc: string, chainId: string, params: BroadcastActionParams) => Promise<{ txHash: string; gameId: string }>;
    /** Runs one allow-listed SDK signing-client method in the main process. */
    signingCall: (network: SignerNetwork, method: SigningMethod, args: unknown[]) => Promise<unknown>;
    resetSigner: () => Promise<void>;
    /** The Ethereum address derived from the same seed phrase (m/44'/60'/0'/0/0). */
    ethAddress: () => Promise<string>;
    ethBalances: () => Promise<EthBalances>;
    /** Approves the bridge if needed and deposits to this wallet's own Block52 address, signed in the main process. */
    ethDeposit: (token: EthDepositToken, amount: bigint) => Promise<EthDepositResult>;
    clear: () => Promise<void>;
    setPassword: (password: string) => Promise<void>;
    changePassword: (current: string, next: string) => Promise<void>;
    removePassword: (current: string) => Promise<void>;
    /** Also lets this PGP public key (armored) unlock the wallet. Without a password it becomes the only way in. */
    setPgpKey: (publicKey: string) => Promise<void>;
    removePgpKey: () => Promise<void>;
    /** Looks a PGP public key up by email or fingerprint on the key server given, then on keys.openpgp.org and keyserver.ubuntu.com. */
    findPgpKey: (query: string, keyServer: string | null) => Promise<FoundPgpKey>;
    setTouchId: (enabled: boolean) => Promise<void>;
    setAutoLock: (minutes: number) => Promise<void>;
    /** Tells the main process the user is still here, so the auto-lock timer restarts. */
    reportActivity: () => void;
    /** Called when the wallet locks itself (timeout or the screen locking). Returns an unsubscribe function. */
    onLocked: (listener: () => void) => () => void;
}
