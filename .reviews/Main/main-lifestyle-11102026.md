# Code Review (lifestyle findings) — main vs a0e0bea

**Generated:** 11/10/2026
**Scope:** committed (58 commits, a0e0bea..e94e548), staged (0), unstaged (0) · +7263 / -457 across 181 files
**Companion:** main-code-11102026.md  *(in this same directory; correctness / security findings live there)*

## Summary

| Category  | Count |
|-----------|-------|
| Critical  | 0     |
| Serious   | 0     |
| Moderate  | 4     |
| Minor     | 4     |
| Nit       | 0     |

### Critical
No Critical findings — clean run.

### Serious
No Serious findings — clean run.

### Moderate
- Repo-wide · Code follows the repo's existing conventions (`interface`, `function` declarations, `export default` components, `src/utils/`, flat `components/<domain>/` folders, relative imports), which differ from the shared gates (type not interface, arrow functions, named exports only, no `utils/`, `components/<Name>/<Name>.tsx`, `@/` alias). Nothing in this diff made it worse, but none of it conforms. · gate: frontend-patterns / File Naming, TypeScript Discipline, Functions · fix: decide whether the desktop repo adopts the gates (then migrate in a dedicated change) or documents its divergence in CLAUDE.md.
- Many files (81 `??` / `||` added, e.g. `Table.tsx:147,174,256,260`) · `gameState?.previousActions.length ?? 0`, `gameState?.handNumber ?? 0`, `gameState?.players.length ?? 0` fall back on SDK values, which the project's inherited "no defaults policy" forbids. · gate: CLAUDE.md inherited rules (no `||`/`??` for SDK values) · fix: gate on `gameState !== undefined` once and pass defined values down.
- Unnecessary exports (added files, no importer outside the file or its test): `isTableTheme`, `resultsAlreadyOnChain`, `ClaimWinningsResult`, `AUTO_ACTION_DELAY_MS`, `setGameSetting`, `reloadGameSettings`, `LastSessionState`, `SngScheduleState`, `TurnTimer`, `currentRoundContribution`, `ChipDenomination`, `ChipStack`, `MAX_STACKS`, `MAX_CHIPS_PER_STACK`, `PageSlice`, `PlayerActionDisplay`, `PlayerActionDisplayInput`, `allowsVoluntarySitOut`, `isBootstrap`, `getTimeZoneOffsetMs`, `getZonedWeekday`, `zonedWallTimeToUtc`, `getNextOccurrence`, `TableSound`, `normalizeTimestamp`, `WalletHandsPage`, plus the `*Props` interfaces of `ChipPile`, `SeatBanner`, `StepButtons`, `TournamentStrip`. Several are exported only so tests can reach them. · gate: coding-standards / Visibility & Scoping · fix: drop `export` on the ones with no importer; test through the public function where practical.
- `src/pages/table/Table.tsx` (803 lines) · One component wires settings, timers, auto actions, sounds, modals, the step dock, history and the header. Hard to review and easy to break. · gate: frontend-patterns / component structure · fix: pull the auto-action wiring, the step/sit-in derivation and the modal set into their own hooks/components.

### Minor
- `src/components/table/TableHeader.tsx` · Every secondary control is rendered twice (inline "wide" version and the ⋯ menu copy), including a duplicated wallet-refresh SVG and the settings rows, kept in sync by hand. · fix: render the menu items from one list.
- Single-letter callback parameters (`h => h.game_id`, `t => t.id`, `p => p.status`, `c => c + …`) in `useMyHands.ts`, `TableHeader.tsx`, `Table.tsx`. · gate: frontend-patterns / Identifier Naming · fix: name them (`hand`, `theme`, `player`, `count`).
- Comments that restate the code or narrate history (e.g. `useAutoActions.ts` per-function JSDoc paragraphs, `seatGeometry.ts` header, "Compresses the raw …" blocks). Genuinely subtle ones (turn-clock latching, sequence-mismatch retry) are fine. · gate: coding-standards / Comments — None by Default · fix: trim to the non-obvious "why".
- `src/hooks/useGameSettings.ts` · Module-level mutable `snapshot` + `listeners` with an exported `reloadGameSettings` "test hook" in production code. · fix: keep the store private; reset it from tests via a module reset.
