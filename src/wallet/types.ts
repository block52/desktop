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

export type WalletCredential = { password: string } | { touchId: true };

/** What the preload script exposes to the page. The seed phrase only leaves the main process through `getMnemonic`. */
export interface WalletBridge {
    status: () => Promise<WalletStatus>;
    unlock: (credential: WalletCredential) => Promise<boolean>;
    /** Re-checks a credential for a sensitive action (revealing the seed) without changing the lock state. */
    authenticate: (credential: WalletCredential) => Promise<boolean>;
    lock: () => Promise<void>;
    getMnemonic: () => Promise<string | null>;
    saveMnemonic: (mnemonic: string) => Promise<void>;
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
