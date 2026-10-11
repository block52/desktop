export interface PageSlice<T> {
    items: T[];
    /** Page actually shown, clamped into [1, pageCount]. */
    page: number;
    pageCount: number;
    total: number;
    /** 1-based index of the first / last item on this page; both 0 when there are no items. */
    first: number;
    last: number;
}

/** Slice a list into a page. A requested page past the end (or before 1) is clamped, never empty. */
export function paginate<T>(list: readonly T[], requestedPage: number, pageSize: number): PageSlice<T> {
    const total = list.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, Math.floor(requestedPage)), pageCount);
    const start = (page - 1) * pageSize;
    const items = list.slice(start, start + pageSize);
    return {
        items,
        page,
        pageCount,
        total,
        first: total === 0 ? 0 : start + 1,
        last: total === 0 ? 0 : start + items.length
    };
}

/**
 * Page numbers to render as buttons: always the first and last page and a window around the
 * current one, with null marking a gap ("…").
 */
export function pageButtons(page: number, pageCount: number, siblings = 1): Array<number | null> {
    const wanted = new Set<number>([1, pageCount]);
    for (let p = page - siblings; p <= page + siblings; p++) {
        if (p >= 1 && p <= pageCount) wanted.add(p);
    }
    const sorted = [...wanted].sort((a, b) => a - b);
    const result: Array<number | null> = [];
    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1) result.push(null);
        result.push(p);
    });
    return result;
}
