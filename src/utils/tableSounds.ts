const SOUND_FILES = import.meta.glob<string>("../assets/sounds/*.mp3", { eager: true, query: "?url", import: "default" });

type TableSound = "all-in" | "bet-raise" | "call" | "check" | "fold" | "show" | "chip-notification";

/** The sound for a table action (bet and raise share one; muck is silent). Null when the action has none. */
export function soundForAction(action: string): TableSound | null {
    switch (action) {
        case "all-in":
            return "all-in";
        case "bet":
        case "raise":
            return "bet-raise";
        case "call":
            return "call";
        case "check":
            return "check";
        case "fold":
            return "fold";
        case "show":
            return "show";
        default:
            return null;
    }
}

/** Play a table sound. Never throws: a sound that can't play (no audio device, decode error) is dropped. */
export function playTableSound(sound: TableSound, volume = 0.5): void {
    try {
        const url = SOUND_FILES[`../assets/sounds/${sound}.mp3`];
        if (url === undefined) return;
        const audio = new Audio(url);
        audio.volume = Math.max(0, Math.min(1, volume));
        void audio.play().catch(() => undefined);
    } catch {
        // Audio unavailable.
    }
}
