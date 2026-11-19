// Renderer-safe player-notes types + limits. The DB module (playerNotesDb.ts)
// imports node:sqlite and must never reach the renderer bundle, so the shared
// shapes and caps live here and the DB module re-uses them.

export const NICKNAME_MAX = 40;
export const NOTES_MAX = 10_000;
export const TAG_MAX = 24;

export interface Tag {
    id: number;
    name: string;
    color: string | null;
}

export interface PlayerNote {
    address: string;
    nickname: string | null;
    notes: string | null;
    tags: Tag[];
    updatedAt: number;
}

export interface PlayerNotesExport {
    version: 1;
    notes: Array<{ address: string; nickname: string | null; notes: string | null; updatedAt: number }>;
    tags: Tag[];
    playerTags: Array<{ address: string; tagId: number }>;
}

/** The players.* surface exposed to the renderer through preload. */
export interface PlayersBridge {
    get: (address: string) => Promise<PlayerNote>;
    getMany: (addresses: string[]) => Promise<Record<string, PlayerNote>>;
    setNickname: (address: string, nickname: string | null) => Promise<void>;
    setNotes: (address: string, notes: string | null) => Promise<void>;
    addTag: (address: string, name: string) => Promise<Tag>;
    removeTag: (address: string, tagId: number) => Promise<void>;
    listTags: () => Promise<Tag[]>;
    renameTag: (id: number, name: string) => Promise<void>;
    deleteTag: (id: number) => Promise<void>;
    search: (text: string) => Promise<string[]>;
    export: () => Promise<PlayerNotesExport>;
    import: (data: PlayerNotesExport) => Promise<void>;
    deleteAll: () => Promise<void>;
}
