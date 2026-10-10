# UI Polish Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the five outstanding UI items the user listed on 2026-10-10: copy-to-clipboard affordances in tables, a shared custom Dropdown replacing the last native `<select>`, styled join-row controls on the poker table page, and an NFT placeholder section on the wallet screen.

**Architecture:** Two new shared components (`CopyButton`, `Dropdown`) plus a clipboard util/hook pair, built in the established dark-sidebar design language (CSS modules, pane tokens, toast feedback). The Dropdown mirrors the existing `NetworkSwitcher` popover pattern. Wiring touches four pages; no state management or data-layer changes.

**Tech Stack:** Electron Forge + Vite + React 19 + TypeScript, CSS modules, vitest (node env; new component tests use the `// @vitest-environment jsdom` pragma), @testing-library/react (new dev dep).

**Spec:** User-reported items from the 2026-10-10 session (no spec doc exists). Design language reference: `docs/superpowers/specs/2026-10-08-dark-sidebar-redesign-design.md`. Tech notes page verified already complete — no task for it.

## Global Constraints

- Package manager: **yarn** (repo has `yarn.lock`). Never npm/pnpm.
- Test runner: `yarn test` (vitest, `environment: "node"` globally — do NOT change vitest.config.ts; per-file jsdom via pragma `// @vitest-environment jsdom` as the first line).
- New dev deps allowed for this plan (one-time install in Task 1): `jsdom`, `@testing-library/dom`, `@testing-library/react`.
- Every test file needs explicit cleanup: `import { cleanup } from "@testing-library/react"; afterEach(cleanup);` (vitest globals are off; RTL auto-cleanup won't register).
- Dark theme tokens (use exactly): pane bg `hsl(240 26% 11%)`, page input bg `hsl(240 38% 5.5%)`, border `hsl(245 22% 17%)`, hover border `hsl(250 28% 22%)`, hover row bg `hsl(245 25% 14%)`, muted text `rgb(148, 163, 184)`, text `hsl(210 40% 98%)` / `var(--text)`, accent `hsl(263 83% 58%)`, check `hsl(263 90% 78%)`, success green `rgb(82, 224, 134)`, fonts `Inter, system-ui, sans-serif` and `var(--mono)`.
- Global utility classes from `src/index.css` (compose in JSX, not CSS): `.pane-lite`, `.btn-ghost`, `.btn-glow`, `.section-label`, `.row-hover`, `.segmented`/`.seg`.
- Feedback pattern: clipboard success → `showSuccess("<thing> copied")`; failure → `showError("Failed to copy")` (encapsulated in the `useCopyToClipboard` hook).
- NO native `<select>` elements anywhere in UI code after Task 3.
- Verification after every task: `yarn test`, `yarn lint`, `npx tsc --noEmit` — all must pass before committing.
- Commit style: match `git log --oneline` (plain lowercase messages, no conventional-commit prefix), one commit per task.

---

### Task 1: Clipboard utility + `useCopyToClipboard` hook

**Files:**
- Modify: `package.json` (devDependencies — one-time test-infra install)
- Create: `src/utils/clipboard.ts`
- Test: `src/utils/clipboard.test.ts`
- Create: `src/hooks/useCopyToClipboard.ts`
- Test: `src/hooks/useCopyToClipboard.test.tsx`

**Interfaces:**
- Produces: `copyText(text: string): Promise<boolean>` (true on success, false on any failure, never throws); `useCopyToClipboard(): (text: string, successMessage?: string) => Promise<boolean>` (shows toast feedback; default success message `"Copied to clipboard"`).

- [ ] **Step 1: Install component-test infrastructure**

```bash
yarn add -D jsdom @testing-library/dom @testing-library/react
```

- [ ] **Step 2: Write the failing utility test**

`src/utils/clipboard.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("copyText", () => {
    it("writes the text to the clipboard and returns true", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });

        const result = await copyText("b52abc");

        expect(writeText).toHaveBeenCalledWith("b52abc");
        expect(result).toBe(true);
    });

    it("returns false when the clipboard write rejects", async () => {
        vi.stubGlobal("navigator", {
            clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }
        });

        expect(await copyText("b52abc")).toBe(false);
    });

    it("returns false when navigator.clipboard is unavailable", async () => {
        vi.stubGlobal("navigator", {});

        expect(await copyText("b52abc")).toBe(false);
    });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `yarn test src/utils/clipboard.test.ts`
Expected: FAIL — `copyText is not a function` (or import error).

- [ ] **Step 4: Write minimal implementation**

`src/utils/clipboard.ts`:

```ts
export async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `yarn test src/utils/clipboard.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the failing hook test**

`src/hooks/useCopyToClipboard.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { ToastProvider } from "../context/ToastContext";
import { useCopyToClipboard } from "./useCopyToClipboard";

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider>{children}</ToastProvider>
);

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("useCopyToClipboard", () => {
    it("copies the text and shows a success toast", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });

        const { result } = renderHook(() => useCopyToClipboard(), { wrapper });
        let ok = false;
        await act(async () => {
            ok = await result.current("b52abc", "Address copied");
        });

        expect(writeText).toHaveBeenCalledWith("b52abc");
        expect(ok).toBe(true);
        expect(document.body.textContent).toContain("Address copied");
    });

    it("shows an error toast when the copy fails", async () => {
        vi.stubGlobal("navigator", {
            clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }
        });

        const { result } = renderHook(() => useCopyToClipboard(), { wrapper });
        await act(async () => {
            await result.current("b52abc");
        });

        expect(document.body.textContent).toContain("Failed to copy");
    });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `yarn test src/hooks/useCopyToClipboard.test.tsx`
Expected: FAIL — module `./useCopyToClipboard` not found.

- [ ] **Step 8: Write the hook**

`src/hooks/useCopyToClipboard.ts`:

```ts
import { useCallback } from "react";
import { useToast } from "../context/ToastContext";
import { copyText } from "../utils/clipboard";

export function useCopyToClipboard(): (text: string, successMessage?: string) => Promise<boolean> {
    const { showSuccess, showError } = useToast();

    return useCallback(
        async (text: string, successMessage = "Copied to clipboard") => {
            const ok = await copyText(text);
            if (ok) {
                showSuccess(successMessage);
            } else {
                showError("Failed to copy");
            }
            return ok;
        },
        [showSuccess, showError]
    );
}
```

- [ ] **Step 9: Run hook + util tests**

Run: `yarn test src/utils/clipboard.test.ts src/hooks/useCopyToClipboard.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 10: Verify lint + types, commit**

```bash
yarn lint && npx tsc --noEmit
git add package.json yarn.lock src/utils/clipboard.ts src/utils/clipboard.test.ts src/hooks/useCopyToClipboard.ts src/hooks/useCopyToClipboard.test.tsx
git commit -m "add copy-to-clipboard utility and hook"
```

---

### Task 2: `CopyButton` component + wire into tables + Wallet toast feedback

**Files:**
- Create: `src/components/copyButton/CopyButton.tsx`
- Create: `src/components/copyButton/CopyButton.module.css`
- Test: `src/components/copyButton/CopyButton.test.tsx`
- Modify: `src/pages/handHistory/HandHistory.tsx` (my-tables row id, winner address)
- Modify: `src/pages/handHistory/HandHistory.module.css` (`.myGameId`, `.winnerAddress`)
- Modify: `src/pages/blockExplorer/BlockExplorer.tsx` (tx result hash, block row hash, block detail hash, tx list)
- Modify: `src/pages/blockExplorer/BlockExplorer.module.css` (`.txValueWrap`, `.hashCell`, `.txListItem`)
- Modify: `src/components/tableList/TableList.tsx` (row subline game id)
- Modify: `src/components/tableList/TableList.module.css` (`.sublineId`)
- Modify: `src/pages/Wallet.tsx` (lines 172, 215, 235 — silent copies get toast feedback)

**Interfaces:**
- Consumes: `useCopyToClipboard` from Task 1.
- Produces: `CopyButton` — default export, props `{ text: string; message?: string; title?: string; className?: string }`. The button always calls `e.stopPropagation()` before copying (safe inside clickable rows).

- [ ] **Step 1: Write the failing component test**

`src/components/copyButton/CopyButton.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "../../context/ToastContext";
import CopyButton from "./CopyButton";

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("CopyButton", () => {
    it("copies its text and shows a success toast on click", () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });

        render(
            <ToastProvider>
                <CopyButton text="b52abc123" message="Address copied" />
            </ToastProvider>
        );

        fireEvent.click(screen.getByRole("button", { name: "Copy" }));

        expect(writeText).toHaveBeenCalledWith("b52abc123");
        expect(screen.getByText("Address copied")).toBeTruthy();
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn test src/components/copyButton/CopyButton.test.tsx`
Expected: FAIL — module `./CopyButton` not found.

- [ ] **Step 3: Write the component**

`src/components/copyButton/CopyButton.tsx`:

```tsx
import React from "react";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import styles from "./CopyButton.module.css";

interface CopyButtonProps {
    text: string;
    message?: string;
    title?: string;
    className?: string;
}

const CopyIcon: React.FC = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

const CopyButton: React.FC<CopyButtonProps> = ({ text, message, title = "Copy", className }) => {
    const copy = useCopyToClipboard();

    return (
        <button
            type="button"
            className={`${styles.copyButton}${className ? ` ${className}` : ""}`}
            title={title}
            aria-label={title}
            onClick={e => {
                e.stopPropagation();
                void copy(text, message);
            }}
        >
            <CopyIcon />
        </button>
    );
};

export default CopyButton;
```

`src/components/copyButton/CopyButton.module.css`:

```css
.copyButton {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid hsl(245 22% 17%);
    border-radius: 6px;
    background: transparent;
    color: rgb(148, 163, 184);
    cursor: pointer;
    transition: background 120ms, color 120ms, border-color 120ms;
}

.copyButton:hover {
    background: hsl(245 25% 14%);
    border-color: hsl(250 28% 22%);
    color: hsl(210 40% 98%);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/components/copyButton/CopyButton.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire into HandHistory**

In `src/pages/handHistory/HandHistory.tsx`:
- Add import: `import CopyButton from "../../components/copyButton/CopyButton";`
- My tables row (currently lines 136-139) — replace `<span className={styles.myGameId}>{shortId(game.gameId)}</span>` with:

```tsx
<span className={styles.myGameId}>
    {shortId(game.gameId)}
    <CopyButton text={game.gameId} message="Table ID copied" title="Copy table ID" />
</span>
```

- Winners row (currently line 240) — replace `<span className={styles.monoMuted}>{shortId(winner.address)}</span>` with:

```tsx
<span className={styles.winnerAddress}>
    {shortId(winner.address)}
    <CopyButton text={winner.address} message="Address copied" title="Copy address" />
</span>
```

In `src/pages/handHistory/HandHistory.module.css`:
- Append:

```css
.myGameId {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.winnerAddress {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--mono);
    font-size: 11px;
    color: rgb(148, 163, 184);
}
```

(`.myGameId` already exists as a plain block rule at lines 96-100 — merge the `display/gap` declarations into it rather than duplicating the selector.)

- [ ] **Step 6: Wire into BlockExplorer**

In `src/pages/blockExplorer/BlockExplorer.tsx`:
- Add import: `import CopyButton from "../../components/copyButton/CopyButton";`
- Tx result hash row (currently lines 130-133) — replace the Hash row with:

```tsx
<div className={styles.txRow}>
    <span className={styles.txLabel}>Hash</span>
    <span className={styles.txValueWrap}>
        <span className={styles.txValueMono}>{txResult.txhash}</span>
        <CopyButton text={txResult.txhash} message="Transaction hash copied" title="Copy hash" />
    </span>
</div>
```

- Latest-blocks row hash cell (currently line 206) — replace `<span className={styles.monoMuted}>{truncateHash(block.block_id.hash)}</span>` with:

```tsx
<span className={styles.hashCell}>
    {truncateHash(block.block_id.hash)}
    <CopyButton text={block.block_id.hash} message="Block hash copied" title="Copy hash" />
</span>
```

- Expanded block detail hash row (currently lines 210-213) — same `txValueWrap` treatment as the tx result hash, with `text={block.block_id.hash}` and `message="Block hash copied"`.
- Tx list items (currently lines 230-234) — replace the span with:

```tsx
<span key={i} className={styles.txListItem}>
    {truncateHash(tx)}
    <CopyButton text={tx} message="Transaction hash copied" title="Copy hash" />
</span>
```

In `src/pages/blockExplorer/BlockExplorer.module.css` — append:

```css
.txValueWrap {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}

.hashCell {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-family: var(--mono);
    font-size: 11px;
    color: rgb(148, 163, 184);
    white-space: nowrap;
}

.txListItem {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
```

- [ ] **Step 7: Wire into TableList**

In `src/components/tableList/TableList.tsx`:
- Add import: `import CopyButton from "../copyButton/CopyButton";`
- Row subline (currently lines 192-194) — replace `{shortId(game.gameId)} · {variantLabel(game)}` block with:

```tsx
<span className={styles.tableSubline}>
    <span className={styles.sublineId}>
        {shortId(game.gameId)}
        <CopyButton text={game.gameId} message="Table ID copied" title="Copy table ID" />
    </span>
    <span>· {variantLabel(game)}</span>
</span>
```

In `src/components/tableList/TableList.module.css` — append:

```css
.sublineId {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
```

- [ ] **Step 8: Wallet page copy feedback**

In `src/pages/Wallet.tsx`:
- Add import: `import { useCopyToClipboard } from "../hooks/useCopyToClipboard";`
- Replace line 172 `const copy = (text: string) => navigator.clipboard.writeText(text);` with `const copy = useCopyToClipboard();`
- Address Copy button (line 215): `onClick={() => copy(existingAddress, "Address copied")}`
- Seed phrase Copy button (line 235): `onClick={() => copy(existingMnemonic, "Seed phrase copied")}`

(`useCopyToClipboard` must be called inside the `Wallet` component body — place the `const copy = ...` line directly after the existing `useState`/`useCosmosWallet` declarations, not after early returns.)

- [ ] **Step 9: Verify and commit**

```bash
yarn test && yarn lint && npx tsc --noEmit
git add src/components/copyButton src/pages/handHistory src/pages/blockExplorer src/components/tableList src/pages/Wallet.tsx
git commit -m "add copy buttons to tables and toast feedback on wallet copies"
```

---

### Task 3: Shared `Dropdown` component + convert HandHistory picker + remove dead NetworkSelector

**Files:**
- Create: `src/components/dropdown/Dropdown.tsx`
- Create: `src/components/dropdown/Dropdown.module.css`
- Test: `src/components/dropdown/Dropdown.test.tsx`
- Modify: `src/pages/handHistory/HandHistory.tsx` (replace `<select>` at lines 156-167)
- Modify: `src/pages/handHistory/HandHistory.module.css` (delete `.select` rule lines 130-146, add `.pickerDropdown`)
- Delete: `src/components/navbar/NetworkSelector.tsx` (orphaned — zero imports) and the `src/components/navbar/` directory if it only contains that file
- Modify: `src/utils/cosmos/urls.ts` (line 10 stale comment: "Uses the network selected in the NetworkSelector dropdown." — it now uses the sidebar NetworkSwitcher; fix the comment)

**Interfaces:**
- Consumes: nothing from earlier tasks (independent of Task 1/2).
- Produces: `Dropdown` default export from `src/components/dropdown/Dropdown.tsx`; `export interface DropdownOption { value: string; label: string; hint?: string }`. Props: `{ value: string; options: DropdownOption[]; onSelect: (value: string) => void; placeholder: string; align?: "up" | "down"; className?: string }`. Selecting the placeholder row calls `onSelect("")` — callers must treat `""` as "no selection" (HandHistory's `handlePickerChange` already does).

- [ ] **Step 1: Write the failing component test**

`src/components/dropdown/Dropdown.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Dropdown, { DropdownOption } from "./Dropdown";

const OPTIONS: DropdownOption[] = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta", hint: "2 players" }
];

afterEach(cleanup);

describe("Dropdown", () => {
    it("shows the selected option's label on the trigger", () => {
        render(<Dropdown value="a" options={OPTIONS} onSelect={() => {}} placeholder="Pick one" />);
        expect(screen.getByRole("button", { expanded: false }).textContent).toContain("Alpha");
    });

    it("shows the placeholder when no value is selected", () => {
        render(<Dropdown value="" options={OPTIONS} onSelect={() => {}} placeholder="Pick one" />);
        expect(screen.getByRole("button", { expanded: false }).textContent).toContain("Pick one");
    });

    it("opens the popover with placeholder + options on click", () => {
        render(<Dropdown value="a" options={OPTIONS} onSelect={() => {}} placeholder="Pick one" />);
        fireEvent.click(screen.getByRole("button", { expanded: false }));

        expect(screen.getByRole("button", { name: /Pick one/ })).toBeTruthy();
        expect(screen.getByRole("button", { name: /Alpha/ })).toBeTruthy();
        expect(screen.getByRole("button", { name: /Beta/ })).toBeTruthy();
        expect(screen.getByText("2 players")).toBeTruthy();
    });

    it("calls onSelect with the option value and closes on selection", () => {
        const onSelect = vi.fn();
        render(<Dropdown value="a" options={OPTIONS} onSelect={onSelect} placeholder="Pick one" />);
        fireEvent.click(screen.getByRole("button", { expanded: false }));
        fireEvent.click(screen.getByRole("button", { name: /Beta/ }));

        expect(onSelect).toHaveBeenCalledWith("b");
        expect(screen.queryByRole("button", { name: /Beta/ })).toBeNull();
    });

    it("closes on Escape", () => {
        render(<Dropdown value="a" options={OPTIONS} onSelect={() => {}} placeholder="Pick one" />);
        const { container } = render(<Dropdown value="a" options={OPTIONS} onSelect={() => {}} placeholder="Other" />);
        fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]);
        fireEvent.keyDown(container.firstChild as Element, { key: "Escape" });

        expect(screen.queryAllByRole("button", { expanded: true })).toHaveLength(0);
    });

    it("closes on outside mousedown", () => {
        render(
            <div>
                <Dropdown value="a" options={OPTIONS} onSelect={() => {}} placeholder="Pick one" />
                <div data-testid="outside" />
            </div>
        );
        fireEvent.click(screen.getByRole("button", { expanded: false }));
        fireEvent.mouseDown(screen.getByTestId("outside"));

        expect(screen.queryAllByRole("button", { expanded: true })).toHaveLength(0);
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn test src/components/dropdown/Dropdown.test.tsx`
Expected: FAIL — module `./Dropdown` not found.

- [ ] **Step 3: Write the component**

`src/components/dropdown/Dropdown.tsx`:

```tsx
import React, { useEffect, useRef, useState } from "react";
import styles from "./Dropdown.module.css";

export interface DropdownOption {
    value: string;
    label: string;
    hint?: string;
}

interface DropdownProps {
    value: string;
    options: DropdownOption[];
    onSelect: (value: string) => void;
    placeholder: string;
    align?: "up" | "down";
    className?: string;
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
const Dropdown: React.FC<DropdownProps> = ({ value, options, onSelect, placeholder, align = "down", className }) => {
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
                    {renderOption({ value: "", label: placeholder })}
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
```

`src/components/dropdown/Dropdown.module.css`:

```css
.wrap {
    position: relative;
    min-width: 0;
}

.trigger {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background-color: hsl(240 38% 5.5%);
    border: 1px solid hsl(245 22% 17%);
    border-radius: 10px;
    color: var(--text);
    font: 400 13px/1 Inter, system-ui, sans-serif;
    cursor: pointer;
    text-align: left;
    outline: none;
    transition: border-color 120ms;
}

.trigger:hover {
    border-color: hsl(250 28% 22%);
}

.trigger:focus-visible {
    border-color: hsl(263 83% 62% / 0.5);
}

.triggerLabel {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.chevron {
    color: rgb(148, 163, 184);
    display: flex;
    align-items: center;
    flex-shrink: 0;
    transition: transform 120ms ease;
}

.chevronOpen {
    transform: rotate(180deg);
}

.popover {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    z-index: 30;
    background: hsl(240 26% 11%);
    border: 1px solid hsl(245 22% 17%);
    border-radius: 12px;
    padding: 4px;
    max-height: 280px;
    overflow-y: auto;
    box-shadow:
        inset 0 1px 0 hsl(263 50% 35% / 0.14),
        0 12px 32px -12px hsl(263 60% 6% / 0.6),
        0 32px 64px -32px hsl(263 60% 4% / 0.9);
}

.popoverUp {
    top: auto;
    bottom: calc(100% + 6px);
}

.option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: hsl(215 20% 65%);
    font: 500 12.5px/1.3 Inter, system-ui, sans-serif;
    cursor: pointer;
    text-align: left;
    transition: background 120ms, color 120ms;
}

.option:hover {
    background: hsl(245 25% 14%);
    color: hsl(210 40% 98%);
}

.optionSelected {
    color: hsl(210 40% 98%);
}

.optionText {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    flex: 1;
}

.optionLabel {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.optionHint {
    font-family: var(--mono);
    font-size: 10px;
    color: rgb(148, 163, 184);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.optionCheck {
    color: hsl(263 90% 78%);
    display: flex;
    align-items: center;
    flex-shrink: 0;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/components/dropdown/Dropdown.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Convert the HandHistory picker**

In `src/pages/handHistory/HandHistory.tsx`:
- Add import: `import Dropdown from "../../components/dropdown/Dropdown";`
- Replace the entire `<select>…</select>` block (lines 156-167) with:

```tsx
<Dropdown
    className={styles.pickerDropdown}
    value={pickerValue}
    onSelect={handlePickerChange}
    placeholder="Choose a live table…"
    options={lobbyGames.map(game => ({
        value: game.gameId,
        label: `${game.name ?? shortId(game.gameId)} — ${formatGameFormatDisplay(game.gameFormat)}`
    }))}
/>
```

`handlePickerChange` (lines 92-96) already handles `""` by clearing state and skipping the load — no change needed. The "or" / free-text input / Load button are untouched.

In `src/pages/handHistory/HandHistory.module.css`:
- Delete the `.select` and `.select:focus` rules (lines 130-146).
- Append:

```css
.pickerDropdown {
    flex: 1 1 220px;
    min-width: 0;
}
```

- [ ] **Step 6: Remove dead NetworkSelector and fix stale comment**

```bash
grep -r "NetworkSelector" src/   # confirm only urls.ts comment + the file itself
rm -rf src/components/navbar     # only after grep confirms nothing else lives there
```

In `src/utils/cosmos/urls.ts` line 10, change "Uses the network selected in the NetworkSelector dropdown." to "Uses the network selected in the sidebar network switcher."

- [ ] **Step 7: Verify no native select remains, run full checks, commit**

```bash
grep -rn "<select" src/   # expect zero matches
yarn test && yarn lint && npx tsc --noEmit
git add -A src/components/dropdown src/components/navbar src/pages/handHistory src/utils/cosmos/urls.ts
git commit -m "replace last native select with shared dropdown component"
```

---

### Task 4: Style the poker table join row

**Files:**
- Modify: `src/pages/table/Table.tsx` (join row inputs + button, lines 199-217)
- Modify: `src/pages/table/Table.module.css` (new `.joinInput` / `.joinButton` rules)

**Interfaces:**
- No new interfaces. Purely visual fix: the two inputs and the Join button currently render as unstyled browser-default white controls inside the dark UI.

- [ ] **Step 1: Add the classNames in Table.tsx**

Replace the join row (lines 199-217) with:

```tsx
<div className={styles.joinRow}>
    <input
        className={styles.joinInput}
        placeholder="Buy-in (USDC)"
        value={buyInAmount}
        onChange={e => setBuyInAmount(e.target.value)}
    />
    <input
        className={styles.joinInput}
        placeholder="Seat (optional)"
        value={seatNumber}
        onChange={e => setSeatNumber(e.target.value)}
    />
    <button
        className={`btn-glow ${styles.joinButton}`}
        disabled={isSubmitting || (!isBalanceLoading && !hasUsdcBalance)}
        onClick={() =>
            runAction("Join", () =>
                joinTable(
                    tableId,
                    { amount: buyInAmount, seatNumber: seatNumber ? Number(seatNumber) : undefined },
                    currentNetwork,
                    getLatestSnapshot
                )
            )
        }
    >
        Join
    </button>
</div>
```

- [ ] **Step 2: Add the CSS**

Append to `src/pages/table/Table.module.css`:

```css
.joinInput {
    flex: 0 1 160px;
    min-width: 0;
    background-color: hsl(240 38% 5.5%);
    border: 1px solid hsl(245 22% 17%);
    color: var(--text);
    font-family: var(--mono);
    font-size: 12px;
    padding: 8px 12px;
    outline: none;
    border-radius: 10px;
    transition: border-color 120ms;
}

.joinInput:focus {
    border-color: hsl(263 83% 62% / 0.5);
}

.joinInput::placeholder {
    color: var(--text-muted);
}

.joinButton {
    height: 34px;
    padding: 0 18px;
    border: 0;
    border-radius: 10px;
    font: 600 13px/1 Inter, system-ui, sans-serif;
    cursor: pointer;
}

.joinButton:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
```

- [ ] **Step 3: Verify**

There is no new unit-testable behavior (visual only). Verify:

```bash
yarn test && yarn lint && npx tsc --noEmit
git add src/pages/table/Table.tsx src/pages/table/Table.module.css
git commit -m "style join row inputs and button on table page"
```

Manual visual check (optional but recommended): `yarn start`, open a table, confirm the join row renders dark inputs + glowing Join button.

---

### Task 5: NFT placeholder gallery on the wallet screen

**Files:**
- Create: `src/components/nft/NftGallery.tsx`
- Create: `src/components/nft/NftGallery.module.css`
- Test: `src/components/nft/NftGallery.test.tsx`
- Modify: `src/pages/Wallet.tsx` (mount after the Current Wallet card, ~line 258)

**Interfaces:**
- Produces: `NftGallery` default export — no props. Static placeholder (no data fetching); real NFT support is future work.

- [ ] **Step 1: Write the failing component test**

`src/components/nft/NftGallery.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import NftGallery from "./NftGallery";

afterEach(cleanup);

describe("NftGallery", () => {
    it("renders the NFT section with placeholder tiles", () => {
        render(<NftGallery />);

        expect(screen.getByText("NFTs")).toBeTruthy();
        expect(screen.getAllByText("Coming soon")).toHaveLength(4);
        expect(screen.getByText(/NFT support is on the way/)).toBeTruthy();
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn test src/components/nft/NftGallery.test.tsx`
Expected: FAIL — module `./NftGallery` not found.

- [ ] **Step 3: Write the component**

`src/components/nft/NftGallery.tsx`:

```tsx
import React from "react";
import styles from "./NftGallery.module.css";

const PLACEHOLDER_COUNT = 4;

const ImageIcon: React.FC = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="9" cy="9" r="1.6" />
        <path d="m21 15-4.5-4.5L6 21" />
    </svg>
);

const NftGallery: React.FC = () => (
    <div className={`pane-lite ${styles.card}`}>
        <div className={styles.header}>
            <span className="section-label">NFTs</span>
            <span className={styles.count}>0</span>
        </div>
        <div className={styles.grid}>
            {Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
                <div key={i} className={styles.tile}>
                    <ImageIcon />
                    <span className={styles.tileLabel}>Coming soon</span>
                </div>
            ))}
        </div>
        <p className={styles.note}>NFT support is on the way — your collectibles will show up here.</p>
    </div>
);

export default NftGallery;
```

`src/components/nft/NftGallery.module.css`:

```css
.card {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.count {
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: rgb(148, 163, 184);
    background: hsl(215 20% 65% / 0.14);
    border-radius: 5px;
    min-width: 17px;
    height: 17px;
    padding: 0 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
}

.tile {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px dashed hsl(250 28% 22%);
    border-radius: 12px;
    color: rgb(148, 163, 184);
    background: hsl(240 38% 5.5% / 0.5);
}

.tileLabel {
    font-size: 10.5px;
    font-weight: 500;
    color: rgb(148, 163, 184);
}

.note {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
}

@media (max-width: 768px) {
    .grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/components/nft/NftGallery.test.tsx`
Expected: PASS.

- [ ] **Step 5: Mount on the wallet page**

In `src/pages/Wallet.tsx`:
- Add import: `import NftGallery from "../components/nft/NftGallery";`
- Insert `{existingAddress && <NftGallery />}` immediately after the closing `</div>` of the "Current Wallet" card (currently line 258), before the Generate card.

- [ ] **Step 6: Verify and commit**

```bash
yarn test && yarn lint && npx tsc --noEmit
git add src/components/nft src/pages/Wallet.tsx
git commit -m "add nft placeholder gallery to wallet screen"
```

---

## Self-Review

**Spec coverage:** (1) copy table address → Tasks 1-2; (2) custom dropdowns → Task 3; (3) table page look → Task 4 (join row — the one clearly-broken element found); (4) NFT placeholder → Task 5; (5) tech notes → already complete, no task. Grep in Task 3 Step 7 guards the "no native select" constraint.

**Placeholder scan:** all steps carry complete code or exact file/line targets; no TBD/fill-in steps.

**Type consistency:** `copyText`/`useCopyToClipboard`/`CopyButton`/`Dropdown`/`DropdownOption`/`NftGallery` signatures identical across every task that references them. HandHistory `handlePickerChange(string)` matches `Dropdown.onSelect`; its `""` handling predates this plan and is unchanged.
