# Connection Lifecycle Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two connection-lifecycle bugs deliberately parked at the end of the previous plan (stale WS messages from a just-replaced socket corrupting state/the shared snapshot baseline; the `CONNECTING` guard blocking a subscribe to a *different* table), and expose the game-state bus's already-computed latest snapshot through the context so action-submission code (a later plan) can read it synchronously.

**Architecture:** Add a generation counter to `GameStateProvider`: each `subscribeToTable` call mints a new generation number; every async WebSocket callback (`onopen`, `onmessage`, `onerror`, the fallback timeout) captures its generation at creation time and checks it's still current before touching any state setter or the shared `GameMessageBus`. `unsubscribeFromTable` and unmount also bump the generation, invalidating any in-flight callbacks from the connection being torn down. Separately, add a thin `getLatestSnapshot()` accessor backed by `GameMessageBus.getLastSnapshot()`, which the bus already computes — no new state, no duplicate mirror.

**Tech Stack:** React 19, TypeScript, native `WebSocket`.

**Spec:** `docs/superpowers/specs/2026-09-24-player-actions-design.md` (the "Plan 2a" and "Two things Plan 1 didn't anticipate" sections)

## Global Constraints

- Quotes: always double quotes in `.ts`/`.tsx` (repo CLAUDE.md).
- No `any` type (repo CLAUDE.md).
- Single-table connect/disconnect (the behavior the previous plan already proved working) must not regress — this plan only adds guards and one accessor, it doesn't change the happy-path flow.
- No automated test for `GameStateContext.tsx` itself — matches the codebase's existing convention for context/provider files (`NetworkContext.tsx`/`ToastContext.tsx` have none either), and an async WS race is not meaningfully unit-testable without a full mock harness. Verification is manual (regression-test the existing connect/disconnect flow) plus careful reasoning about guard placement during review.

---

### Task 1: Generation-counter hardening

**Files:**
- Modify: `src/context/GameStateContext.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports — `subscribeToTable`/`unsubscribeFromTable`'s public signatures are unchanged, only their internal robustness improves. Task 2 (same file) builds on the hardened version.

- [ ] **Step 1: Add the generation ref**

In `GameStateProvider`, alongside the other `useRef` declarations (after `busRef`), add:

```tsx
    const generationRef = useRef(0);
```

- [ ] **Step 2: Narrow the CONNECTING guard to same-table only**

Current code (near the top of `subscribeToTable`):

```tsx
            if (currentTableIdRef.current === tableId && wsRef.current?.readyState === WebSocket.OPEN) {
                return;
            }
            if (wsRef.current?.readyState === WebSocket.CONNECTING) {
                return;
            }
```

Change the second guard to also check `currentTableIdRef.current === tableId`, so a subscribe to a *different* table while the current one is still connecting proceeds (superseding the in-flight connection) instead of silently no-op'ing:

```tsx
            if (currentTableIdRef.current === tableId && wsRef.current?.readyState === WebSocket.OPEN) {
                return;
            }
            if (currentTableIdRef.current === tableId && wsRef.current?.readyState === WebSocket.CONNECTING) {
                return;
            }
```

- [ ] **Step 3: Mint a new generation on every subscribe**

Immediately after the existing `if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }` block (which now may fire for a different-table in-flight connection too, per Step 2), add:

```tsx
            const generation = ++generationRef.current;
```

- [ ] **Step 4: Guard `onopen`, `onmessage`, `onerror`, and the fallback timeout with the captured generation**

In `ws.onopen`, right after the existing `if (wsRef.current !== ws || ws.readyState !== WebSocket.OPEN) { return; }` guard (added in the previous plan's fix wave), add a generation check — both guards stay, they catch different failure modes (the existing one catches "this exact socket was replaced"; the generation check additionally catches "a newer subscribe happened, even one that hasn't replaced `wsRef` yet at this exact instant"):

```tsx
            ws.onopen = async () => {
                const authPayload = await createAuthPayload();

                if (wsRef.current !== ws || ws.readyState !== WebSocket.OPEN || generationRef.current !== generation) {
                    return;
                }

                const subscriptionMessage = {
                    type: "subscribe",
                    gameId: tableId,
                    playerAddress: authPayload?.playerAddress ?? playerAddress,
                    timestamp: authPayload?.timestamp,
                    signature: authPayload?.signature,
                };

                ws.send(JSON.stringify(subscriptionMessage));
                setIsLoading(false);

                fallbackTimeoutRef.current = setTimeout(() => {
                    if (generationRef.current !== generation) {
                        return;
                    }
                    if (!hasReceivedMessageRef.current && currentTableIdRef.current === tableId) {
                        console.error("[GameStateContext] WebSocket server did not respond within 5 seconds");
                        setError(
                            new Error(
                                "WebSocket server not responding. The game server may be offline or not broadcasting game state. " +
                                    "Please try refreshing or contact support if the issue persists."
                            )
                        );
                        setIsLoading(false);
                    }
                }, 5000);
            };
```

In `ws.onmessage`, add the generation check right at the top, before the `try`/`JSON.parse`:

```tsx
            ws.onmessage = event => {
                if (generationRef.current !== generation) {
                    return;
                }

                let message: RawWsMessage;
                try {
                    message = JSON.parse(event.data);
                } catch (err) {
                    console.error("[GameStateContext] Failed to parse WebSocket message:", (err as Error).message);
                    setError(new Error("Error parsing WebSocket message"));
                    return;
                }

                hasReceivedMessageRef.current = true;

                const item = busRef.current?.ingest(message, tableId);
                if (!item) {
                    return;
                }

                switch (item.classified.kind) {
                    case "state": {
                        setLatestEvents(item.events);
                        setGameState(item.classified.snapshot);
                        setGameFormat(item.classified.format);
                        setGameVariant(item.classified.variant);
                        setGameName(item.classified.name);
                        setPendingAction(null);
                        if (item.classified.validationError) {
                            setValidationError(item.classified.validationError);
                        } else {
                            setError(null);
                            setValidationError(null);
                        }
                        break;
                    }
                    case "validationErrorNoState": {
                        setValidationError(item.classified.validationError);
                        break;
                    }
                    case "pending": {
                        setPendingAction(item.classified.pendingAction);
                        break;
                    }
                    case "actionAccepted": {
                        break;
                    }
                    case "error": {
                        setError(item.classified.error);
                        setIsLoading(false);
                        setPendingAction(null);
                        if (item.classified.clearGameState) {
                            setGameState(undefined);
                        }
                        break;
                    }
                    default:
                        break;
                }
            };
```

In `ws.onerror`, add the generation check before doing anything else:

```tsx
            ws.onerror = wsError => {
                if (generationRef.current !== generation) {
                    return;
                }
                console.error("WebSocket error:", wsError);
                setError(new Error(`WebSocket connection error for table ${tableId}`));
                setIsLoading(false);
            };
```

`ws.onclose` is unchanged (`if (wsRef.current === ws) { wsRef.current = null; }`) — it only touches a ref, not React state or the bus, so it doesn't need the generation guard.

- [ ] **Step 5: Bump the generation in `unsubscribeFromTable` and on unmount**

At the very start of `unsubscribeFromTable`, before its existing body:

```tsx
    const unsubscribeFromTable = useCallback(() => {
        generationRef.current += 1;
        if (fallbackTimeoutRef.current) {
            clearTimeout(fallbackTimeoutRef.current);
            fallbackTimeoutRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        currentTableIdRef.current = null;
        hasReceivedMessageRef.current = false;
        busRef.current?.reset();
        setLatestEvents([]);
        setGameState(undefined);
        setGameFormat(undefined);
        setGameVariant(undefined);
        setGameName(undefined);
        setIsLoading(false);
        setError(null);
        setValidationError(null);
        setPendingAction(null);
    }, []);
```

At the start of the unmount cleanup function inside the existing `useEffect`:

```tsx
    useEffect(() => {
        return () => {
            generationRef.current += 1;
            if (fallbackTimeoutRef.current) {
                clearTimeout(fallbackTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);
```

- [ ] **Step 6: Verify**

Run: `yarn lint`
Expected: no new errors.

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as before this change (this task adds no new type errors — compare against the count from before starting, not just a grep of this one file).

Run: `yarn start`, then manually: connect to a table (same flow the previous plan verified), confirm state still updates normally; navigate away and confirm no console errors; navigate to a second table and confirm it connects cleanly (the regression case this task must not break).

- [ ] **Step 7: Commit**

```bash
git add src/context/GameStateContext.tsx
git commit -m "fix: guard WebSocket callbacks against stale connection generations"
```

---

### Task 2: Expose `getLatestSnapshot()`

**Files:**
- Modify: `src/context/GameStateContext.tsx`

**Interfaces:**
- Consumes: `GameMessageBus.getLastSnapshot()` (existing, already merged, `src/bus/GameMessageBus.ts`).
- Produces: `getLatestSnapshot(): TexasHoldemStateDTO | undefined` on `GameStateValue`/`useGameState()` — consumed by a later plan's `joinTable`/`useAutoNewHand` action hooks (not built yet).

- [ ] **Step 1: Add the field to `GameStateValue`**

```tsx
export interface GameStateValue {
    gameState: TexasHoldemStateDTO | undefined;
    gameFormat: GameFormat | undefined;
    gameVariant: GameVariant | undefined;
    gameName: string | undefined;
    isLoading: boolean;
    error: Error | null;
    validationError: ValidationError | null;
    pendingAction: PendingAction | null;
    latestEvents: GameEvent[];
    subscribeToTable: (tableId: string) => void;
    unsubscribeFromTable: () => void;
    getLatestSnapshot: () => TexasHoldemStateDTO | undefined;
}
```

- [ ] **Step 2: Implement it in the provider**

Add alongside the other `useCallback`-wrapped functions (order doesn't matter, but placing it after `unsubscribeFromTable` reads naturally):

```tsx
    const getLatestSnapshot = useCallback((): TexasHoldemStateDTO | undefined => {
        return busRef.current?.getLastSnapshot();
    }, []);
```

- [ ] **Step 3: Add it to the context value**

```tsx
    return (
        <GameStateContext.Provider
            value={{
                gameState,
                gameFormat,
                gameVariant,
                gameName,
                isLoading,
                error,
                validationError,
                pendingAction,
                latestEvents,
                subscribeToTable,
                unsubscribeFromTable,
                getLatestSnapshot,
            }}
        >
            {children}
        </GameStateContext.Provider>
    );
```

- [ ] **Step 4: Verify**

Run: `yarn lint`
Expected: no new errors.

Run: `npx tsc --noEmit 2>&1 | wc -l`
Expected: same count as after Task 1 (no new errors).

Run: `yarn start`, connect to a table, and confirm (via a temporary `console.log` you add and then remove, or by checking in DevTools) that `getLatestSnapshot()` returns the same snapshot currently shown in `Table.tsx`'s existing JSON dump once a state message has arrived, and `undefined` before any has.

- [ ] **Step 5: Commit**

```bash
git add src/context/GameStateContext.tsx
git commit -m "feat: expose getLatestSnapshot() on the game-state context"
```

---

## Self-Review Notes

- **Spec coverage:** both items from the spec's "Plan 2a" section are covered — generation-counter hardening (Task 1, closing both parked findings from the previous plan) and `getLatestSnapshot()` exposure (Task 2).
- **Type consistency:** `getLatestSnapshot`'s signature in Task 2's interface addition matches its implementation and matches what the spec says a later plan will consume (`TexasHoldemStateDTO | undefined`).
- **No regression:** Task 1's steps preserve every existing line of behavior for the single-table case (the generation always matches on a first, uninterrupted subscribe) — the guards are additive short-circuits that only fire when a *newer* subscribe has already happened, which cannot occur on the first/only subscribe of a session.
