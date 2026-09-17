/**
 * Type guard utilities for common null/undefined/empty checks.
 * Mirrors pvm/ts/src/utils/guards.ts for consistency across the stack.
 */

export function hasValue<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}

export function isNullish(value: unknown): value is null | undefined {
    return value === null || value === undefined;
}

export function isEmpty<T>(arr: T[] | null | undefined): boolean {
    return !arr || arr.length === 0;
}

export function hasElements<T>(arr: T[] | null | undefined): arr is T[] {
    return arr !== null && arr !== undefined && arr.length > 0;
}

export function safeLength<T>(arr: T[] | null | undefined): number {
    return arr?.length ?? 0;
}

export function isBlank(value: string | null | undefined): boolean {
    return value === null || value === undefined || value === "";
}

export function hasContent(value: string | null | undefined): value is string {
    return value !== null && value !== undefined && value !== "";
}
