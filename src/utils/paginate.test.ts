import { describe, expect, it } from "vitest";
import { pageButtons, paginate } from "./paginate";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("paginate", () => {
    it("slices a page and reports the visible range", () => {
        const p = paginate(range(25), 2, 10);
        expect(p.items).toEqual(range(25).slice(10, 20));
        expect(p).toMatchObject({ page: 2, pageCount: 3, total: 25, first: 11, last: 20 });
    });

    it("shows a short last page", () => {
        expect(paginate(range(25), 3, 10)).toMatchObject({ first: 21, last: 25 });
    });

    it("clamps a page past the end or before the start", () => {
        expect(paginate(range(5), 9, 10).page).toBe(1);
        expect(paginate(range(25), 99, 10).page).toBe(3);
        expect(paginate(range(25), 0, 10).page).toBe(1);
    });

    it("handles an empty list", () => {
        expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, pageCount: 1, total: 0, first: 0, last: 0 });
    });
});

describe("pageButtons", () => {
    it("lists every page when there are few", () => {
        expect(pageButtons(1, 3)).toEqual([1, 2, 3]);
    });

    it("keeps first, last and a window, with gaps", () => {
        expect(pageButtons(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
        expect(pageButtons(1, 10)).toEqual([1, 2, null, 10]);
        expect(pageButtons(10, 10)).toEqual([1, null, 9, 10]);
    });

    it("does not insert a gap for adjacent pages", () => {
        expect(pageButtons(3, 6)).toEqual([1, 2, 3, 4, null, 6]);
    });
});
