import { app, BrowserWindow, ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import path from "node:path";
import { isValidBech32Address } from "../utils/bech32";
import { PlayerNotesDb } from "./playerNotesDb";
import type { PlayerNote, PlayerNotesExport, Tag } from "./playerNotesDb";

const ADDRESS_PREFIX = "b52";

/**
 * Local player notes over IPC. The SQLite file lives in the app's user-data
 * folder and is owned by the main process; the page asks for everything and
 * never opens the file (same boundary as the wallet). Every address is
 * validated as b52 bech32, and calls only come from the app's own window.
 */
export function registerPlayerNotesIpc(): void {
    let db: PlayerNotesDb | null = null;
    const open = (): PlayerNotesDb => {
        if (db === null) db = new PlayerNotesDb(path.join(app.getPath("userData"), "players.db"));
        return db;
    };

    const trusted = (event: IpcMainInvokeEvent): boolean =>
        BrowserWindow.fromWebContents(event.sender) !== null && event.senderFrame === event.sender.mainFrame;

    const requireAddress = (value: unknown): string => {
        if (typeof value !== "string" || !isValidBech32Address(value, ADDRESS_PREFIX)) {
            throw new Error("Invalid player address.");
        }
        return value;
    };
    const asTextOrNull = (value: unknown): string | null => {
        if (value === null || value === undefined) return null;
        if (typeof value !== "string") throw new Error("Expected text.");
        return value;
    };
    const asId = (value: unknown): number => {
        if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new Error("Invalid id.");
        return value;
    };

    const handle = <Args extends unknown[], Result>(channel: string, run: (...args: Args) => Result) => {
        ipcMain.handle(channel, (event, ...args) => {
            if (!trusted(event)) throw new Error("Untrusted caller.");
            return run(...(args as Args));
        });
    };

    handle("players:get", (address: unknown): PlayerNote => open().get(requireAddress(address)));

    handle("players:get-many", (addresses: unknown): Record<string, PlayerNote> => {
        if (!Array.isArray(addresses)) throw new Error("Expected an array of addresses.");
        return open().getMany(addresses.map(requireAddress));
    });

    handle("players:set-nickname", (address: unknown, nickname: unknown): void =>
        open().setNickname(requireAddress(address), asTextOrNull(nickname))
    );

    handle("players:set-notes", (address: unknown, notes: unknown): void =>
        open().setNotes(requireAddress(address), asTextOrNull(notes))
    );

    handle("players:add-tag", (address: unknown, name: unknown): Tag => {
        if (typeof name !== "string") throw new Error("Expected a tag name.");
        return open().addTag(requireAddress(address), name);
    });

    handle("players:remove-tag", (address: unknown, tagId: unknown): void =>
        open().removeTag(requireAddress(address), asId(tagId))
    );

    handle("players:list-tags", (): Tag[] => open().listTags());

    handle("players:rename-tag", (id: unknown, name: unknown): void => {
        if (typeof name !== "string") throw new Error("Expected a tag name.");
        open().renameTag(asId(id), name);
    });

    handle("players:delete-tag", (id: unknown): void => open().deleteTag(asId(id)));

    handle("players:search", (text: unknown): string[] => {
        if (typeof text !== "string") throw new Error("Expected search text.");
        return open().search(text);
    });

    handle("players:export", (): PlayerNotesExport => open().export());

    handle("players:import", (data: unknown): void => {
        if (typeof data !== "object" || data === null) throw new Error("Invalid backup.");
        open().import(data as PlayerNotesExport);
    });

    handle("players:delete-all", (): void => open().deleteAll());
}
