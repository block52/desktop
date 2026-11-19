import { BrowserWindow, ipcMain, net } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { searchHands } from "./handSearch";
import type { HandSearchResult } from "./handSearch";

const DEFAULT_INDEXER_URL = "https://indexer.block52.xyz";

function setting(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Search through the indexer's GraphQL API. The API key is injected at build time (VITE_INDEXER_API_KEY) and stays in
 * the main process: the page asks for a search by name and never sees the key or sends its own queries.
 */
export function registerIndexerIpc(): void {
    const apiKey = setting(import.meta.env.VITE_INDEXER_API_KEY);
    const indexerUrl = setting(import.meta.env.VITE_INDEXER_URL) ?? DEFAULT_INDEXER_URL;

    const trusted = (event: IpcMainInvokeEvent): boolean => BrowserWindow.fromWebContents(event.sender) !== null && event.senderFrame === event.sender.mainFrame;

    ipcMain.handle("indexer:search-available", (event): boolean => {
        if (!trusted(event)) throw new Error("Untrusted caller.");
        return apiKey !== null;
    });

    ipcMain.handle("indexer:search-hands", async (event, text: unknown, limit: unknown, offset: unknown): Promise<HandSearchResult> => {
        if (!trusted(event)) throw new Error("Untrusted caller.");
        if (apiKey === null) return { available: false };
        const result = await searchHands({ indexerUrl, apiKey, fetch: (url, init) => net.fetch(url, init) }, text, limit, offset);
        return { available: true, ...result };
    });
}
