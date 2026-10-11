import React from "react";
import { pageButtons, type PageInfo } from "../../utils/paginate";
import styles from "./Pagination.module.css";

export const PAGE_SIZES = [15, 30, 50] as const;

interface PaginationProps {
    slice: PageInfo;
    /** Disable the controls while a page is loading. */
    disabled?: boolean;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ slice, pageSize, onPageChange, onPageSizeChange, disabled = false }) => {
    const { page, pageCount, total, first, last } = slice;
    if (total === 0) return null;

    return (
        <div className={styles.bar}>
            <span className={styles.summary}>
                {first}–{last} of {total}
            </span>

            <div className={styles.controls}>
                <label className={styles.sizeLabel}>
                    Rows
                    <select
                        className={styles.sizeSelect}
                        value={pageSize}
                        onChange={e => onPageSizeChange(Number(e.target.value))}
                        aria-label="Rows per page"
                    >
                        {PAGE_SIZES.map(size => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                </label>

                <nav className={styles.pages} aria-label="Table pages">
                    <button
                        type="button"
                        className={`btn-ghost ${styles.pageButton}`}
                        onClick={() => onPageChange(page - 1)}
                        disabled={disabled || page <= 1}
                        aria-label="Previous page"
                    >
                        ‹
                    </button>
                    {pageButtons(page, pageCount).map((pageNumber, position) =>
                        pageNumber === null ? (
                            <span key={`gap-${position}`} className={styles.gap} aria-hidden="true">
                                …
                            </span>
                        ) : (
                            <button
                                key={pageNumber}
                                type="button"
                                className={`btn-ghost ${styles.pageButton} ${pageNumber === page ? styles.current : ""}`}
                                onClick={() => onPageChange(pageNumber)}
                                aria-current={pageNumber === page ? "page" : undefined}
                            >
                                {pageNumber}
                            </button>
                        )
                    )}
                    <button
                        type="button"
                        className={`btn-ghost ${styles.pageButton}`}
                        onClick={() => onPageChange(page + 1)}
                        disabled={disabled || page >= pageCount}
                        aria-label="Next page"
                    >
                        ›
                    </button>
                </nav>
            </div>
        </div>
    );
};

export default Pagination;
