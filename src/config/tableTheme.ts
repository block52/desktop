/** The web app's table themes, switchable from the table header and remembered per device. */

export type TableTheme = "modern" | "classic" | "nouns";

export const TABLE_THEMES: ReadonlyArray<{ id: TableTheme; label: string }> = [
    { id: "modern", label: "Modern" },
    { id: "classic", label: "Classic" },
    { id: "nouns", label: "Nouns" }
];

const STORAGE_KEY = "b52_table_theme";

export function isTableTheme(value: unknown): value is TableTheme {
    return value === "modern" || value === "classic" || value === "nouns";
}

export function loadTableTheme(): TableTheme {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return isTableTheme(stored) ? stored : "modern";
    } catch {
        return "modern";
    }
}

export function saveTableTheme(theme: TableTheme): void {
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        // Storage unavailable: the theme simply won't persist.
    }
}

export function nextTableTheme(theme: TableTheme): TableTheme {
    const index = TABLE_THEMES.findIndex(t => t.id === theme);
    return TABLE_THEMES[(index + 1) % TABLE_THEMES.length].id;
}
