import { describe, expect, it, vi } from "vitest";
import { DeepLinkInbox } from "./deepLinkInbox";

function make() {
    const send = vi.fn();
    const focus = vi.fn();
    return { inbox: new DeepLinkInbox(send, focus), send, focus };
}

describe("DeepLinkInbox", () => {
    it("holds a link that arrives before the page is ready and hands it over once", () => {
        const { inbox, send, focus } = make();
        inbox.open("/table/a");
        expect(send).not.toHaveBeenCalled();
        expect(focus).toHaveBeenCalledOnce();
        expect(inbox.rendererReady()).toBe("/table/a");
        expect(inbox.rendererReady()).toBeNull();
    });

    it("keeps only the newest link while waiting", () => {
        const { inbox } = make();
        inbox.open("/table/a");
        inbox.open("/tournament/b");
        expect(inbox.rendererReady()).toBe("/tournament/b");
    });

    it("sends straight through once the page is ready, and focuses the window each time", () => {
        const { inbox, send, focus } = make();
        inbox.rendererReady();
        inbox.open("/table/a");
        expect(send).toHaveBeenCalledWith("/table/a");
        expect(focus).toHaveBeenCalledOnce();
    });

    it("holds links again while the page reloads", () => {
        const { inbox, send } = make();
        inbox.rendererReady();
        inbox.rendererGone();
        inbox.open("/table/a");
        expect(send).not.toHaveBeenCalled();
        expect(inbox.rendererReady()).toBe("/table/a");
    });
});
