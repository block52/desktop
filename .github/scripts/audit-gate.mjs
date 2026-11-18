#!/usr/bin/env node
// Reads `yarn audit --json` on stdin and fails (exit 1) if there is any
// moderate-or-higher advisory that is NOT in the ignore list passed as args.
// yarn 1.x has no native --exclude, so the gate lives here. Ignored ids are
// documented in ci.yml (things with no fix available to us).
//
// Usage: yarn audit --groups dependencies --json | node audit-gate.mjs <id> <id> ...

import { createInterface } from "node:readline";

const ignore = new Set(process.argv.slice(2).map(Number));
const blocking = new Set(["moderate", "high", "critical"]);
const offenders = new Map(); // id -> { module, severity }

const rl = createInterface({ input: process.stdin });
rl.on("line", line => {
    if (line.trim() === "") return;
    let obj;
    try {
        obj = JSON.parse(line);
    } catch {
        return;
    }
    if (obj.type !== "auditAdvisory") return;
    const a = obj.data.advisory;
    if (!blocking.has(a.severity)) return;
    if (ignore.has(a.id)) return;
    offenders.set(a.id, { module: a.module_name, severity: a.severity });
});

rl.on("close", () => {
    if (offenders.size === 0) {
        console.log(`audit gate: clean (ignored ${[...ignore].join(", ") || "none"})`);
        process.exit(0);
    }
    console.error("audit gate: new moderate+ advisories not in the ignore list:");
    for (const [id, o] of offenders) {
        console.error(`  advisory ${id}  ${o.severity}  ${o.module}`);
    }
    console.error("Fix the dependency, or add the id to the audit step in ci.yml with a reason.");
    process.exit(1);
});
