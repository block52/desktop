#!/usr/bin/env node
// Copies the desktop app's shared presentational primitives into a checkout of
// the @block52/ui-sdk repo, VERBATIM. The desktop repo is the source of truth;
// ui-sdk is never hand-edited. Fix a component here, re-run this, then publish
// ui-sdk.
//
// Usage:
//   yarn sync:ui-sdk [--dest ../ui-sdk]
//   UI_SDK_DIR=/path/to/ui-sdk yarn sync:ui-sdk
//
// The files are copied preserving their src/ sub-paths (components/<domain>/…,
// utils/…, context/…, hooks/…) so the components' own relative imports
// (../../utils/paginate, ../../context/ToastContext) resolve unchanged in
// ui-sdk — hence "verbatim, no import rewriting".

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(here, "..");

// ---- the allowlist -------------------------------------------------------
// Each component entry lists the files to copy (relative to desktop/src) and
// the named/default exports the generated barrel should re-export.
const COMPONENTS = [
  {
    dir: "components/background",
    files: ["AppBackground.tsx", "AppBackground.module.css"],
    exports: [{ from: "./components/background/AppBackground", default: "AnimatedBackground" }],
  },
  {
    dir: "components/pagination",
    files: ["Pagination.tsx", "Pagination.module.css"],
    exports: [
      { from: "./components/pagination/Pagination", default: "Pagination" },
      { from: "./components/pagination/Pagination", named: ["PAGE_SIZES"] },
    ],
  },
  {
    dir: "components/tooltip",
    files: ["Tooltip.tsx", "Tooltip.module.css"],
    exports: [{ from: "./components/tooltip/Tooltip", default: "Tooltip" }],
  },
  {
    dir: "components/dropdown",
    files: ["Dropdown.tsx", "Dropdown.module.css", "Dropdown.test.tsx"],
    exports: [
      { from: "./components/dropdown/Dropdown", default: "Dropdown" },
      { from: "./components/dropdown/Dropdown", namedTypes: ["DropdownOption"] },
    ],
  },
  {
    dir: "components/slidingTabs",
    files: ["SlidingTabs.tsx", "SlidingTabs.module.css", "SlidingTabs.test.tsx"],
    exports: [{ from: "./components/slidingTabs/SlidingTabs", default: "SlidingTabs" }],
  },
  {
    dir: "components/copyButton",
    files: ["CopyButton.tsx", "CopyButton.module.css", "CopyButton.test.tsx"],
    exports: [{ from: "./components/copyButton/CopyButton", default: "CopyButton" }],
  },
  {
    dir: "components/toast",
    files: ["Toast.tsx", "Toast.module.css"],
    exports: [{ from: "./components/toast/Toast", default: "ToastViewport" }],
  },
];

// Shared non-component deps the components import. Copied verbatim, re-exported
// so consumers can use the toast context and pagination helpers directly.
const SUPPORT = [
  {
    files: ["utils/paginate.ts", "utils/paginate.test.ts"],
    exports: [
      { from: "./utils/paginate", named: ["pageInfo", "paginate", "pageButtons"] },
      { from: "./utils/paginate", namedTypes: ["PageInfo"] },
    ],
  },
  {
    files: ["context/ToastContext.tsx"],
    exports: [
      { from: "./context/ToastContext", named: ["ToastProvider", "useToast"] },
      { from: "./context/ToastContext", namedTypes: ["ToastItem"] },
    ],
  },
  {
    files: ["hooks/useCopyToClipboard.ts", "hooks/useCopyToClipboard.test.tsx"],
    exports: [{ from: "./hooks/useCopyToClipboard", named: ["useCopyToClipboard"] }],
  },
  {
    // Imported by useCopyToClipboard; also a useful standalone export.
    files: ["utils/clipboard.ts", "utils/clipboard.test.ts"],
    exports: [{ from: "./utils/clipboard", named: ["copyText"] }],
  },
];

// Directories under ui-sdk/src this script owns and clears before each run.
const MANAGED_DIRS = ["components", "utils", "context", "hooks"];

// ---- resolve destination -------------------------------------------------
function parseDest() {
  const i = process.argv.indexOf("--dest");
  if (i !== -1 && process.argv[i + 1]) return resolve(process.argv[i + 1]);
  if (process.env.UI_SDK_DIR) return resolve(process.env.UI_SDK_DIR);
  return resolve(desktopRoot, "..", "ui-sdk");
}

const destRoot = parseDest();
const destSrc = join(destRoot, "src");

if (!existsSync(destRoot)) {
  console.error(`✗ ui-sdk checkout not found at: ${destRoot}`);
  console.error("  Clone it (gh repo clone block52/ui-sdk) or pass --dest / UI_SDK_DIR.");
  process.exit(1);
}

// ---- copy ----------------------------------------------------------------
console.log(`→ syncing desktop primitives into ${destRoot}`);

for (const d of MANAGED_DIRS) {
  const p = join(destSrc, d);
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}

let count = 0;
function copyOne(relPath) {
  const from = join(desktopRoot, "src", relPath);
  const to = join(destSrc, relPath);
  if (!existsSync(from)) {
    console.error(`✗ missing source file: src/${relPath}`);
    process.exit(1);
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
  count += 1;
  console.log(`  + src/${relPath}`);
}

for (const entry of [...COMPONENTS, ...SUPPORT]) {
  if (entry.dir) {
    for (const f of entry.files) copyOne(join(entry.dir, f));
  } else {
    for (const f of entry.files) copyOne(f);
  }
}

// ---- generate the barrel -------------------------------------------------
function renderExports(entries) {
  const lines = [];
  for (const e of entries.flatMap((x) => x.exports)) {
    if (e.default && e.named) {
      lines.push(`export { default as ${e.default}, ${e.named.join(", ")} } from "${e.from}";`);
    } else if (e.default) {
      lines.push(`export { default as ${e.default} } from "${e.from}";`);
    }
    if (e.named && !e.default) {
      lines.push(`export { ${e.named.join(", ")} } from "${e.from}";`);
    }
    if (e.namedTypes) {
      lines.push(`export type { ${e.namedTypes.join(", ")} } from "${e.from}";`);
    }
  }
  return lines;
}

const barrel = [
  "// AUTO-GENERATED by desktop/tools/sync-ui-sdk.mjs — do not edit by hand.",
  "// Source of truth: block52/desktop src/. Re-run `yarn sync:ui-sdk` to refresh.",
  "",
  "// Components",
  ...renderExports(COMPONENTS),
  "",
  "// Shared helpers & context",
  ...renderExports(SUPPORT),
  "",
].join("\n");

mkdirSync(destSrc, { recursive: true });
writeFileSync(join(destSrc, "index.ts"), barrel);
console.log(`  + src/index.ts (barrel)`);

console.log(`\n✓ copied ${count} file(s). Next: cd ${destRoot} && yarn build`);
console.log("  (Imports are copied verbatim; if the build errors on an unresolved");
console.log("   import, add the missing dep to the manifest in this script.)");
