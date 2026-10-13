import { useEffect, useState } from "react";

/**
 * Attach the returned ref callback to an element; the second value is the tallest it has been (px).
 * Keeping the maximum means something sized from it never jumps when the element shrinks again.
 */
export function useMaxElementHeight(): [(element: HTMLElement | null) => void, number] {
    const [element, setElement] = useState<HTMLElement | null>(null);
    const [maxHeight, setMaxHeight] = useState(0);

    useEffect(() => {
        if (element === null) return;
        const observer = new ResizeObserver(entries => {
            const height = Math.ceil(entries[0].contentRect.height);
            setMaxHeight(previous => Math.max(previous, height));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [element]);

    return [setElement, maxHeight];
}
