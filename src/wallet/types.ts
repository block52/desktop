export interface VaultStatus {
    /** A wallet is saved. */
    exists: boolean;
    locked: boolean;
    hasPassword: boolean;
    touchIdEnabled: boolean;
    /** 0 means never. */
    autoLockMinutes: number;
    /** False when the OS can only obfuscate (a Linux machine without a keyring), so the seed is not truly protected. */
    osProtected: boolean;
}

export interface WalletStatus extends VaultStatus {
    touchIdAvailable: boolean;
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
] as const;

export type SigningMethod = (typeof SIGNING_METHODS)[number];

export interface SignerNetwork {
    rpc: string;
    rest: string;
}

export type WalletCredential = { password: string } | { touchId: true };

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
    /** Runs one allow-listed SDK signing-client method in the main process. */
    signingCall: (network: SignerNetwork, method: SigningMethod, args: unknown[]) => Promise<unknown>;
    resetSigner: () => Promise<void>;
    clear: () => Promise<void>;
    setPassword: (password: string) => Promise<void>;
    changePassword: (current: string, next: string) => Promise<void>;
    removePassword: (current: string) => Promise<void>;
    setTouchId: (enabled: boolean) => Promise<void>;
    setAutoLock: (minutes: number) => Promise<void>;
    /** Tells the main process the user is still here, so the auto-lock timer restarts. */
    reportActivity: () => void;
    /** Called when the wallet locks itself (timeout or the screen locking). Returns an unsubscribe function. */
    onLocked: (listener: () => void) => () => void;
}
