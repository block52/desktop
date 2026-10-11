import React, { useEffect, useRef, useState } from "react";
import styles from "./Dropdown.module.css";

export interface DropdownOption {
    value: string;
    label: string;
    hint?: string;
    disabled?: boolean;
}

interface DropdownProps {
    value: string;
    options: DropdownOption[];
    onSelect: (value: string) => void;
    placeholder: string;
    align?: "up" | "down";
    className?: string;
    /** Adds the placeholder as a selectable "none" row. Off for required choices. */
    allowEmpty?: boolean;
}

const ChevronDownIcon: React.FC = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

const CheckIcon: React.FC = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

/** Custom dropdown in the sidebar NetworkSwitcher pattern: button trigger, popover
 *  list, checkmark on the selected option, closes on outside mousedown / Escape. */
const Dropdown: React.FC<DropdownProps> = ({ value, options, onSelect, placeholder, align = "down", className, allowEmpty = true }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const choose = (optionValue: string) => {
        onSelect(optionValue);
        setIsOpen(false);
    };

    const selected = options.find(o => o.value === value);

    const renderOption = (option: DropdownOption) => {
        const isSelected = option.value === value;
        return (
            <button
                key={option.value === "" ? "__placeholder" : option.value}
                type="button"
                className={isSelected ? `${styles.option} ${styles.optionSelected}` : styles.option}
                onClick={() => choose(option.value)}
                disabled={option.disabled}
            >
                <span className={styles.optionText}>
                    <span className={styles.optionLabel}>{option.label}</span>
                    {option.hint && <span className={styles.optionHint}>{option.hint}</span>}
                </span>
                {isSelected && (
                    <span className={styles.optionCheck}>
                        <CheckIcon />
                    </span>
                )}
            </button>
        );
    };

    return (
        <div
            className={`${styles.wrap}${className ? ` ${className}` : ""}`}
            ref={containerRef}
            onKeyDown={e => {
                if (e.key === "Escape") setIsOpen(false);
            }}
        >
            {isOpen && (
                <div className={align === "up" ? `${styles.popover} ${styles.popoverUp}` : styles.popover}>
                    {allowEmpty && renderOption({ value: "", label: placeholder })}
                    {options.map(renderOption)}
                </div>
            )}
            <button
                type="button"
                className={styles.trigger}
                onClick={() => setIsOpen(open => !open)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className={styles.triggerLabel}>{selected ? selected.label : placeholder}</span>
                <span className={isOpen ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron}>
                    <ChevronDownIcon />
                </span>
            </button>
        </div>
    );
};

export default Dropdown;
