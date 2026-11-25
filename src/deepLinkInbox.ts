/**
 * Holds a link until the page can take it. A link can arrive before the window exists or before the page has
 * mounted (a cold start from the OS), so it is kept as pending and handed over when the page says it is ready;
 * after that, links are sent straight through.
 */
export class DeepLinkInbox {
    private pending: string | null = null;
    private ready = false;

    constructor(
        private readonly send: (route: string) => void,
        private readonly focus: () => void
    ) {}

    open(route: string): void {
        this.focus();
        if (this.ready) this.send(route);
        else this.pending = route;
    }

    /** The page mounted and is listening: returns the link that came first, once. */
    rendererReady(): string | null {
        this.ready = true;
        const route = this.pending;
        this.pending = null;
        return route;
    }

    /** The page is loading again (reload, or a new window): hold links until it says so. */
    rendererGone(): void {
        this.ready = false;
    }
}
