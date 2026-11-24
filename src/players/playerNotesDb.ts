import { DatabaseSync } from "node:sqlite";
import { NICKNAME_MAX, NOTES_MAX, TAG_MAX } from "./types";
import type { PlayerNote, PlayerNotesExport, Tag } from "./types";

export type { PlayerNote, PlayerNotesExport, Tag } from "./types";
export { NICKNAME_MAX, NOTES_MAX, TAG_MAX } from "./types";

// Local, private player notes (nickname, free text, tags) kept in a SQLite file
// owned by the Electron main process. Never leaves the machine (issue #63).
//
// node:sqlite ships with the Electron runtime's Node (24.21), so there is no
// native module to rebuild per platform.

/** A fixed palette the UI offers for tag colours; stored as a plain string. */
export const TAG_COLORS = ["slate", "violet", "green", "amber", "red", "blue"] as const;
export type TagColor = (typeof TAG_COLORS)[number];

const SCHEMA_VERSION = 1;

export class PlayerNotesDb {
    private readonly db: DatabaseSync;

    constructor(filePath: string, now: () => number = Date.now) {
        this.db = new DatabaseSync(filePath);
        this.now = now;
        this.db.exec("PRAGMA foreign_keys = ON");
        this.migrate();
    }

    private readonly now: () => number;

    private migrate(): void {
        this.db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)");
        const row = this.db.prepare("SELECT version FROM schema_version LIMIT 1").get() as { version: number } | undefined;
        const current = row?.version ?? 0;
        if (current >= SCHEMA_VERSION) return;
        if (current < 1) {
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS player_notes (
                    address    TEXT PRIMARY KEY,
                    nickname   TEXT,
                    notes      TEXT,
                    updated_at INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS tags (
                    id    INTEGER PRIMARY KEY,
                    name  TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    color TEXT
                );
                CREATE TABLE IF NOT EXISTS player_tags (
                    address TEXT NOT NULL,
                    tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                    PRIMARY KEY (address, tag_id)
                );
            `);
        }
        if (row === undefined) this.db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(SCHEMA_VERSION);
        else this.db.prepare("UPDATE schema_version SET version = ?").run(SCHEMA_VERSION);
    }

    // --- reads ---

    get(address: string): PlayerNote {
        const map = this.getMany([address]);
        return map[address] ?? { address, nickname: null, notes: null, tags: [], updatedAt: 0 };
    }

    /** One call for a whole list or table. Returns a map keyed by address; absent players get an empty note. */
    getMany(addresses: string[]): Record<string, PlayerNote> {
        const out: Record<string, PlayerNote> = {};
        if (addresses.length === 0) return out;
        const unique = [...new Set(addresses)];
        const placeholders = unique.map(() => "?").join(",");

        const noteRows = this.db
            .prepare(`SELECT address, nickname, notes, updated_at FROM player_notes WHERE address IN (${placeholders})`)
            .all(...unique) as Array<{ address: string; nickname: string | null; notes: string | null; updated_at: number }>;
        for (const r of noteRows) {
            out[r.address] = { address: r.address, nickname: r.nickname, notes: r.notes, tags: [], updatedAt: r.updated_at };
        }

        const tagRows = this.db
            .prepare(
                `SELECT pt.address AS address, t.id AS id, t.name AS name, t.color AS color
                 FROM player_tags pt JOIN tags t ON t.id = pt.tag_id
                 WHERE pt.address IN (${placeholders})
                 ORDER BY t.name COLLATE NOCASE`
            )
            .all(...unique) as Array<{ address: string; id: number; name: string; color: string | null }>;
        for (const r of tagRows) {
            const note = out[r.address] ?? { address: r.address, nickname: null, notes: null, tags: [], updatedAt: 0 };
            note.tags.push({ id: r.id, name: r.name, color: r.color });
            out[r.address] = note;
        }
        return out;
    }

    /** Addresses whose nickname, notes, or a tag name contain `text` (case-insensitive). */
    search(text: string): string[] {
        if (text.trim() === "") return [];
        const q = `%${text.trim().toLowerCase()}%`;
        const rows = this.db
            .prepare(
                `SELECT address FROM player_notes WHERE lower(nickname) LIKE ? OR lower(notes) LIKE ?
                 UNION
                 SELECT pt.address FROM player_tags pt JOIN tags t ON t.id = pt.tag_id WHERE lower(t.name) LIKE ?`
            )
            .all(q, q, q) as Array<{ address: string }>;
        return rows.map(r => r.address);
    }

    listTags(): Tag[] {
        return this.db.prepare("SELECT id, name, color FROM tags ORDER BY name COLLATE NOCASE").all() as unknown as Tag[];
    }

    // --- writes ---

    setNickname(address: string, nickname: string | null): void {
        const value = this.cap(nickname, NICKNAME_MAX);
        this.upsert(address, { nickname: value });
    }

    setNotes(address: string, notes: string | null): void {
        const value = this.cap(notes, NOTES_MAX);
        this.upsert(address, { notes: value });
    }

    /** Adds the tag to the player, creating the tag if it does not exist yet. Returns the tag. */
    addTag(address: string, name: string, color: string | null = null): Tag {
        const clean = this.cap(name, TAG_MAX);
        if (clean === null || clean === "") throw new Error("Tag name is required.");
        this.db.prepare("INSERT INTO tags (name, color) VALUES (?, ?) ON CONFLICT(name) DO NOTHING").run(clean, color);
        const tag = this.db.prepare("SELECT id, name, color FROM tags WHERE name = ? COLLATE NOCASE").get(clean) as unknown as Tag;
        // Ensure a row exists so the player shows up even with no nickname/notes.
        this.upsert(address, {});
        this.db.prepare("INSERT INTO player_tags (address, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING").run(address, tag.id);
        return tag;
    }

    removeTag(address: string, tagId: number): void {
        this.db.prepare("DELETE FROM player_tags WHERE address = ? AND tag_id = ?").run(address, tagId);
    }

    renameTag(id: number, name: string): void {
        const clean = this.cap(name, TAG_MAX);
        if (clean === null || clean === "") throw new Error("Tag name is required.");
        this.db.prepare("UPDATE tags SET name = ? WHERE id = ?").run(clean, id);
    }

    deleteTag(id: number): void {
        this.db.prepare("DELETE FROM tags WHERE id = ?").run(id); // player_tags rows cascade
    }

    /** Wipes every note and tag (the Settings "delete all" action). */
    deleteAll(): void {
        this.db.exec("DELETE FROM player_tags; DELETE FROM tags; DELETE FROM player_notes;");
    }

    export(): PlayerNotesExport {
        const notes = this.db.prepare("SELECT address, nickname, notes, updated_at AS updatedAt FROM player_notes").all() as PlayerNotesExport["notes"];
        const tags = this.listTags();
        const playerTags = this.db.prepare("SELECT address, tag_id AS tagId FROM player_tags").all() as PlayerNotesExport["playerTags"];
        return { version: 1, notes, tags, playerTags };
    }

    /** Replaces all data with the backup. */
    import(data: PlayerNotesExport): void {
        if (data.version !== 1) throw new Error("Unsupported backup version.");
        this.deleteAll();
        const insNote = this.db.prepare("INSERT INTO player_notes (address, nickname, notes, updated_at) VALUES (?, ?, ?, ?)");
        for (const n of data.notes) insNote.run(n.address, this.cap(n.nickname, NICKNAME_MAX), this.cap(n.notes, NOTES_MAX), n.updatedAt);
        const insTag = this.db.prepare("INSERT INTO tags (id, name, color) VALUES (?, ?, ?)");
        for (const t of data.tags) insTag.run(t.id, this.cap(t.name, TAG_MAX), t.color);
        const insPt = this.db.prepare("INSERT INTO player_tags (address, tag_id) VALUES (?, ?)");
        for (const pt of data.playerTags) insPt.run(pt.address, pt.tagId);
    }

    close(): void {
        this.db.close();
    }

    // --- helpers ---

    private upsert(address: string, fields: { nickname?: string | null; notes?: string | null }): void {
        const now = this.now();
        const exists = this.db.prepare("SELECT 1 FROM player_notes WHERE address = ?").get(address) !== undefined;
        if (!exists) {
            this.db
                .prepare("INSERT INTO player_notes (address, nickname, notes, updated_at) VALUES (?, ?, ?, ?)")
                .run(address, fields.nickname ?? null, fields.notes ?? null, now);
            return;
        }
        const sets: string[] = [];
        const values: Array<string | null | number> = [];
        if ("nickname" in fields) { sets.push("nickname = ?"); values.push(fields.nickname ?? null); }
        if ("notes" in fields) { sets.push("notes = ?"); values.push(fields.notes ?? null); }
        sets.push("updated_at = ?");
        values.push(now, address);
        this.db.prepare(`UPDATE player_notes SET ${sets.join(", ")} WHERE address = ?`).run(...values);
    }

    /** Trim, cap length, and turn an empty string into null. */
    private cap(value: string | null, max: number): string | null {
        if (value === null) return null;
        const trimmed = value.trim();
        if (trimmed === "") return null;
        return trimmed.slice(0, max);
    }
}
