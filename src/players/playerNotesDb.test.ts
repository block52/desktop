import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NICKNAME_MAX, NOTES_MAX, PlayerNotesDb } from "./playerNotesDb";

const A = "b5219rl4cm2hmr8afy4kldpxz3fka4jguq0avffg09";
const B = "b521p78923d2qjzfywxajdy9hgz2rfrhg9gz0ujhwk";

describe("PlayerNotesDb", () => {
    let db: PlayerNotesDb;
    let clock = 1_000;

    beforeEach(() => {
        clock = 1_000;
        db = new PlayerNotesDb(":memory:", () => clock);
    });
    afterEach(() => db.close());

    it("returns an empty note for an unknown address", () => {
        expect(db.get(A)).toEqual({ address: A, nickname: null, notes: null, tags: [], updatedAt: 0 });
    });

    it("stores and reads a nickname and notes", () => {
        db.setNickname(A, "The Villain");
        clock = 2_000;
        db.setNotes(A, "3-bets light from the button");
        const note = db.get(A);
        expect(note.nickname).toBe("The Villain");
        expect(note.notes).toBe("3-bets light from the button");
        expect(note.updatedAt).toBe(2_000);
    });

    it("trims, empties to null, and caps length", () => {
        db.setNickname(A, "  spaced  ");
        expect(db.get(A).nickname).toBe("spaced");
        db.setNickname(A, "   ");
        expect(db.get(A).nickname).toBeNull();
        db.setNotes(A, "x".repeat(NOTES_MAX + 50));
        expect(db.get(A).notes?.length).toBe(NOTES_MAX);
        db.setNickname(A, "y".repeat(NICKNAME_MAX + 10));
        expect(db.get(A).nickname?.length).toBe(NICKNAME_MAX);
    });

    it("adds, lists and removes tags (dedup, case-insensitive)", () => {
        const reg = db.addTag(A, "reg");
        db.addTag(A, "REG"); // same tag, different case → no duplicate
        db.addTag(A, "fish");
        expect(db.get(A).tags.map(t => t.name).sort()).toEqual(["fish", "reg"]);
        expect(db.listTags()).toHaveLength(2);

        db.removeTag(A, reg.id);
        expect(db.get(A).tags.map(t => t.name)).toEqual(["fish"]);
        // The tag still exists globally after being removed from one player.
        expect(db.listTags().map(t => t.name).sort()).toEqual(["fish", "reg"]);
    });

    it("deleting a tag cascades to player_tags", () => {
        const reg = db.addTag(A, "reg");
        db.addTag(B, "reg");
        db.deleteTag(reg.id);
        expect(db.get(A).tags).toEqual([]);
        expect(db.get(B).tags).toEqual([]);
        expect(db.listTags()).toEqual([]);
    });

    it("renames a tag everywhere it is used", () => {
        const t = db.addTag(A, "agro");
        db.renameTag(t.id, "aggressive");
        expect(db.get(A).tags[0].name).toBe("aggressive");
    });

    it("getMany returns a map and batches notes + tags", () => {
        db.setNickname(A, "Alice");
        db.addTag(A, "reg");
        db.setNotes(B, "calls too much");
        const map = db.getMany([A, B, "b521unknownxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"]);
        expect(map[A].nickname).toBe("Alice");
        expect(map[A].tags.map(t => t.name)).toEqual(["reg"]);
        expect(map[B].notes).toBe("calls too much");
        expect(map[B].tags).toEqual([]);
        expect(map["b521unknownxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"]).toBeUndefined();
    });

    it("searches nicknames and notes", () => {
        db.setNickname(A, "Shark");
        db.setNotes(B, "a total shark on the river");
        expect(db.search("shark").sort()).toEqual([A, B].sort());
        expect(db.search("river")).toEqual([B]);
        expect(db.search("")).toEqual([]);
    });

    it("exports and re-imports a full backup", () => {
        db.setNickname(A, "Alice");
        db.setNotes(A, "tight");
        db.addTag(A, "reg");
        db.addTag(B, "fish");
        const backup = db.export();

        db.deleteAll();
        expect(db.get(A).nickname).toBeNull();
        expect(db.listTags()).toEqual([]);

        db.import(backup);
        expect(db.get(A).nickname).toBe("Alice");
        expect(db.get(A).notes).toBe("tight");
        expect(db.get(A).tags.map(t => t.name)).toEqual(["reg"]);
        expect(db.get(B).tags.map(t => t.name)).toEqual(["fish"]);
    });

    it("deleteAll wipes everything", () => {
        db.setNickname(A, "Alice");
        db.addTag(A, "reg");
        db.deleteAll();
        expect(db.get(A)).toEqual({ address: A, nickname: null, notes: null, tags: [], updatedAt: 0 });
        expect(db.listTags()).toEqual([]);
    });
});
