import { MAX_GAME_NAME_LENGTH } from "@block52/poker-vm-sdk";

const TABLE_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Chain rule: lowercase [a-z0-9-], 1–32 chars, no leading/trailing or double hyphen. */
export function isValidTableName(name: string): boolean {
    return name.length >= 1 && name.length <= MAX_GAME_NAME_LENGTH && TABLE_NAME_PATTERN.test(name);
}

/** Typing helper: lowercases, turns spaces into hyphens, drops characters the chain rejects. */
export function sanitizeTableNameInput(raw: string): string {
    return raw
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-{2,}/g, "-")
        .slice(0, MAX_GAME_NAME_LENGTH);
}
