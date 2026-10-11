import { useSyncExternalStore } from "react";

/** Per-device table play preferences (same keys and defaults as the web app's game settings). */
export interface GameSettings {
    autoDeal: boolean;
    autoPostBlinds: boolean;
    autoNewHand: boolean;
    /** Fold (or check when free) when the turn clock runs out. */
    autoFold: boolean;
    /** Muck losing cards at showdown without asking. */
    autoMuck: boolean;
    /** Offer a "Check" box before your turn when checking would be free. */
    preSelectCheck: boolean;
    /** Play a cue for each player action. */
    playerActionSounds: boolean;
    /** Chime when it becomes your turn. */
    turnNotificationSound: boolean;
}

export type GameSettingKey = keyof GameSettings;

const STORAGE_KEYS: Record<GameSettingKey, string> = {
    autoDeal: "setting_autodeal",
    autoPostBlinds: "setting_autoblinds",
    autoNewHand: "setting_autonewhand",
    autoFold: "setting_autofold",
    autoMuck: "setting_automuck",
    preSelectCheck: "setting_preselectcheck",
    playerActionSounds: "setting_playeractionsounds",
    turnNotificationSound: "setting_turnsound"
};

const DEFAULTS: GameSettings = {
    autoDeal: true,
    autoPostBlinds: true,
    autoNewHand: true,
    autoFold: true,
    autoMuck: false,
    preSelectCheck: false,
    playerActionSounds: true,
    turnNotificationSound: true
};

function readStored(key: GameSettingKey): boolean {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS[key]);
        return stored === null ? DEFAULTS[key] : stored === "true";
    } catch {
        return DEFAULTS[key];
    }
}

function readAll(): GameSettings {
    return {
        autoDeal: readStored("autoDeal"),
        autoPostBlinds: readStored("autoPostBlinds"),
        autoNewHand: readStored("autoNewHand"),
        autoFold: readStored("autoFold"),
        autoMuck: readStored("autoMuck"),
        preSelectCheck: readStored("preSelectCheck"),
        playerActionSounds: readStored("playerActionSounds"),
        turnNotificationSound: readStored("turnNotificationSound")
    };
}

let snapshot: GameSettings = readAll();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getSnapshot(): GameSettings {
    return snapshot;
}

export function setGameSetting(key: GameSettingKey, value: boolean): void {
    snapshot = { ...snapshot, [key]: value };
    try {
        localStorage.setItem(STORAGE_KEYS[key], String(value));
    } catch {
        // Storage unavailable: the setting applies for this session only.
    }
    listeners.forEach(listener => listener());
}

/** Test hook: re-read settings from storage. */
export function reloadGameSettings(): void {
    snapshot = readAll();
    listeners.forEach(listener => listener());
}

export function useGameSettings(): GameSettings & { toggle: (key: GameSettingKey) => void } {
    const settings = useSyncExternalStore(subscribe, getSnapshot);
    return { ...settings, toggle: key => setGameSetting(key, !snapshot[key]) };
}
