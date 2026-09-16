# Web3 Deposit Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Web3 direct-deposit flow (ERC20 USDC/USDT approve + deposit into the Cosmos bridge contract) to the `desktop` Electron app, replacing the current "Deposit" button's no-op navigation to the wallet page.

**Architecture:** Port five small wagmi-wrapper hooks and an ERC20 ABI from `ui` (self-contained, no backend dependency), add a `depositAbi` alongside `desktop`'s existing `withdrawAbi` on the same bridge contract, and build a new `DepositModal.tsx` (structured like the existing `SendModal.tsx`) that composes those hooks into an approve→deposit flow, minting funds to the user's existing Cosmos wallet address. A toolchain upgrade (vite/typescript/eslint) lands first as an independent prerequisite.

**Tech Stack:** React 19, wagmi 3 / viem 2, `@reown/appkit`, TypeScript, Vite (Electron Forge plugin), ESLint flat config, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-16-desktop-web-port-design.md`

## Global Constants

- Bridge contract address (already in `desktop`): `BRIDGE_ADDRESS = "0xE4E22A524f2b104cB71fB154f72736bd02722fF4"` — `src/abis/contractABI.ts`
- `ETH_CHAIN_ID = 1`
- `ETH_USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"`
- `ETH_USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7"`
- New dependency: `bigunit` at `^1.2.5` (matches `ui`'s pinned version)
- Toolchain targets: `vite@^8.1.4`, `typescript@^7.0.2`, `eslint@^10.1.0`, `typescript-eslint@^8.57.2` (replaces `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser`), `@eslint/js@^10.0.1`, `eslint-plugin-react-hooks@^7.0.1`, `eslint-plugin-react-refresh@^0.5.2`, `globals@^17.4.0`
- Quotes: always double quotes in `.ts`/`.tsx` (repo CLAUDE.md)
- Package manager: `yarn`, never `npm install` (repo CLAUDE.md)
- No `||`/`??` fallback for SDK values — this plan introduces none; existing violations in `AppKitProvider.tsx`/`Dashboard.tsx` are pre-existing and out of scope

---

### Task 1: Toolchain upgrade (vite/typescript/eslint)

**Files:**
- Modify: `package.json`
- Delete: `.eslintrc.json`
- Create: `eslint.config.mjs`
- Modify: `tsconfig.json`

**Interfaces:**
- Produces: a working `yarn lint` and `yarn start` on the new toolchain versions — every later task's `yarn lint`/`yarn start` verification step depends on this.

- [ ] **Step 1: Bump devDependency versions in `package.json`**

Edit the `devDependencies` block:

```json
    "@electron-forge/cli": "^7.11.2",
    "@electron-forge/maker-deb": "^7.11.2",
    "@electron-forge/maker-rpm": "^7.11.2",
    "@electron-forge/maker-squirrel": "^7.11.2",
    "@electron-forge/maker-zip": "^7.11.2",
    "@electron-forge/plugin-auto-unpack-natives": "^7.11.2",
    "@electron-forge/plugin-fuses": "^7.11.2",
    "@electron-forge/plugin-vite": "^7.11.2",
    "@electron/fuses": "^1.8.0",
    "@eslint/js": "^10.0.1",
    "@types/electron-squirrel-startup": "^1.0.2",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "electron": "41.3.0",
    "eslint": "^10.1.0",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.4.0",
    "typescript": "^7.0.2",
    "typescript-eslint": "^8.57.2",
    "vite": "^8.1.4"
```

This removes `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, and `eslint-plugin-import` (replaced by the combined `typescript-eslint` package; `eslint-plugin-import`'s `import/no-unresolved` rule has been producing false positives against `@reown/appkit`'s subpath exports and `ui` doesn't use it either).

- [ ] **Step 2: Install**

Run: `yarn install`
Expected: resolves cleanly, `yarn.lock` updated. Peer-dependency warnings about `@wagmi/core`/`starknet` are pre-existing (seen before this change) and not a failure.

- [ ] **Step 3: Replace `.eslintrc.json` with a flat config**

Delete `.eslintrc.json`. Create `eslint.config.mjs`:

```js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [".vite", "out", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "quotes": ["error", "double"],
      "semi": ["error", "always"],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-unused-expressions": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "no-console": ["warn", { "allow": ["error"] }],
    },
  },
);
```

(Matches `ui`'s `eslint.config.mjs` exactly, except `ignores` points at `desktop`'s actual build output dirs — `.vite/` and `out/`, from `desktop`'s `.gitignore` — instead of `ui`'s `dist`.)

- [ ] **Step 4: Tighten `tsconfig.json`**

Edit `tsconfig.json` to:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "jsx": "react-jsx",
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "moduleDetection": "force",
    "sourceMap": true,
    "baseUrl": ".",
    "outDir": "dist",
    "moduleResolution": "node",
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

This adds `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `moduleDetection` on top of the existing config; `noImplicitAny` is now implied by `strict`. Nothing in `desktop`'s build (`electron-forge` + Vite, esbuild-transpiled per file) or `yarn lint` runs `tsc` as a gate, so this changes editor/manual `tsc` diagnostics only — it will not block `yarn start` or `yarn lint`, and this task does not attempt to fix any newly-surfaced `strict`-mode errors across the existing codebase (out of scope; note the count in Step 6 for visibility only).

- [ ] **Step 5: Lint and compare against the pre-upgrade baseline**

Run: `yarn lint`
Expected: rule set has changed (flat config, `typescript-eslint` v8, `eslint-plugin-import` removed), so the output will differ from any prior baseline. Fix only genuine violations of repo rules that are cheap and unambiguous (e.g. a stray single-quoted string — `quotes: ["error", "double"]` is now enforced, matching CLAUDE.md). Do not chase pre-existing `@typescript-eslint/no-unused-vars`/`no-explicit-any` warnings introduced by the stricter `typescript-eslint` v8 ruleset; note the count instead.

- [ ] **Step 6: Verify the app still starts**

Run: `yarn start` (background/foreground, check for a launched Electron window and no crash in the terminal output — same verification used for the earlier dependency upgrade in this repo). Also run `npx tsc --noEmit` and note the resulting error count (expected: non-zero, pre-existing — not a gate).

- [ ] **Step 7: Commit**

```bash
git add package.json yarn.lock eslint.config.mjs tsconfig.json
git rm .eslintrc.json
git commit -m "chore: upgrade toolchain to vite 8 / typescript 7 / eslint 10 flat config"
```

---

### Task 2: ERC20 ABI, deposit ABI, and Ethereum constants

**Files:**
- Create: `src/abis/erc20ABI.ts`
- Create: `src/config/constants.ts`
- Modify: `src/abis/contractABI.ts`

**Interfaces:**
- Consumes: nothing (foundational).
- Produces: `erc20abi` (named export, `src/abis/erc20ABI.ts`), `ETH_CHAIN_ID`/`ETH_USDC_ADDRESS`/`ETH_USDT_ADDRESS` (named exports, `src/config/constants.ts`), `depositAbi` (named export, `src/abis/contractABI.ts`, alongside the existing `withdrawAbi`/`BRIDGE_ADDRESS`) — all four tasks below import from these.

- [ ] **Step 1: Create `src/abis/erc20ABI.ts`**

```ts
export const erc20abi = [
    {
        constant: true,
        inputs: [],
        name: "name",
        outputs: [{ name: "", type: "string" }],
        payable: false,
        stateMutability: "view",
        type: "function"
    },
    {
        constant: false,
        inputs: [
            { name: "_spender", type: "address" },
            { name: "_value", type: "uint256" }
        ],
        name: "approve",
        outputs: [{ name: "", type: "bool" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        constant: true,
        inputs: [],
        name: "totalSupply",
        outputs: [{ name: "", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function"
    },
    {
        constant: false,
        inputs: [
            { name: "_from", type: "address" },
            { name: "_to", type: "address" },
            { name: "_value", type: "uint256" }
        ],
        name: "transferFrom",
        outputs: [{ name: "", type: "bool" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        constant: true,
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", type: "uint8" }],
        payable: false,
        stateMutability: "view",
        type: "function"
    },
    {
        constant: true,
        inputs: [{ name: "_owner", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "balance", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function"
    },
    {
        constant: true,
        inputs: [],
        name: "symbol",
        outputs: [{ name: "", type: "string" }],
        payable: false,
        stateMutability: "view",
        type: "function"
    },
    {
        constant: false,
        inputs: [
            { name: "_to", type: "address" },
            { name: "_value", type: "uint256" }
        ],
        name: "transfer",
        outputs: [{ name: "", type: "bool" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        constant: true,
        inputs: [
            { name: "_owner", type: "address" },
            { name: "_spender", type: "address" }
        ],
        name: "allowance",
        outputs: [{ name: "", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function"
    },
    { payable: true, stateMutability: "payable", type: "fallback" },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: "owner", type: "address" },
            { indexed: true, name: "spender", type: "address" },
            { indexed: false, name: "value", type: "uint256" }
        ],
        name: "Approval",
        type: "event"
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: "from", type: "address" },
            { indexed: true, name: "to", type: "address" },
            { indexed: false, name: "value", type: "uint256" }
        ],
        name: "Transfer",
        type: "event"
    }
] as const;
```

- [ ] **Step 2: Create `src/config/constants.ts`**

```ts
export const ETH_CHAIN_ID = 1;
export const ETH_USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
export const ETH_USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
```

- [ ] **Step 3: Add `depositAbi` to `src/abis/contractABI.ts`**

Read the current file first (`src/abis/contractABI.ts`, currently `withdrawAbi` + `BRIDGE_ADDRESS`). Add, without removing the existing exports:

```ts
export const depositAbi = [
    {
        inputs: [
            { internalType: "uint256", name: "amount",   type: "uint256" },
            { internalType: "string",  name: "receiver", type: "string"  }
        ],
        name: "depositUnderlying",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            { internalType: "uint256", name: "amount",   type: "uint256" },
            { internalType: "string",  name: "receiver", type: "string"  },
            { internalType: "address", name: "token",    type: "address" }
        ],
        name: "deposit",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "nonpayable",
        type: "function"
    }
] as const;
```

- [ ] **Step 4: Verify**

Run: `yarn lint`
Expected: no new errors from these three files (double-quoted strings, no unused vars).

- [ ] **Step 5: Commit**

```bash
git add src/abis/erc20ABI.ts src/config/constants.ts src/abis/contractABI.ts
git commit -m "feat: add ERC20 ABI, deposit ABI, and Ethereum constants for deposit flow"
```

---

### Task 3: Currency conversion utility + Vitest setup

**Files:**
- Create: `src/utils/currency.ts`
- Test: `src/utils/currency.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json` (add `vitest` devDependency, `bigunit` dependency, `test` script)

**Interfaces:**
- Consumes: nothing.
- Produces: `convertAmountToBigInt(amount: string, decimals: number): bigint` (named export, `src/utils/currency.ts`) — used by `DepositModal.tsx` in Task 6.

- [ ] **Step 1: Add dependencies**

Run: `yarn add bigunit@^1.2.5` and `yarn add -D vitest`
Expected: both added to `package.json`/`yarn.lock`.

- [ ] **Step 2: Add the `test` script**

Edit `package.json`'s `scripts` block, adding:

```json
    "test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
    },
});
```

(`environment: "node"` — this plan adds no component-render tests, only pure-logic tests, so no `jsdom` dependency is needed.)

- [ ] **Step 4: Write the failing test**

Create `src/utils/currency.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { convertAmountToBigInt } from "./currency";

describe("convertAmountToBigInt", () => {
    it("converts a decimal USDC amount to micro-units", () => {
        expect(convertAmountToBigInt("1.5", 6)).toBe(1500000n);
    });

    it("converts a whole-number amount", () => {
        expect(convertAmountToBigInt("10", 6)).toBe(10000000n);
    });

    it("returns 0n for an empty amount", () => {
        expect(convertAmountToBigInt("", 6)).toBe(0n);
    });

    it("returns 0n for a zero amount", () => {
        expect(convertAmountToBigInt("0", 6)).toBe(0n);
    });

    it("returns 0n when decimals is 0", () => {
        expect(convertAmountToBigInt("1.5", 0)).toBe(0n);
    });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `yarn test`
Expected: FAIL — `src/utils/currency.ts` does not exist yet ("Cannot find module './currency'" or similar).

- [ ] **Step 6: Write the implementation**

Create `src/utils/currency.ts`:

```ts
import { BigUnit } from "bigunit";

export const convertAmountToBigInt = (amount: string, decimals: number): bigint => {
    if (!decimals || !amount || !+amount) return BigInt(0);
    return BigUnit.from(+amount, decimals).toBigInt();
};
```

- [ ] **Step 7: Run test to verify it passes**

Run: `yarn test`
Expected: PASS, all 5 assertions green.

- [ ] **Step 8: Commit**

```bash
git add package.json yarn.lock vitest.config.ts src/utils/currency.ts src/utils/currency.test.ts
git commit -m "test: add vitest and a currency conversion utility for the deposit flow"
```

---

### Task 4: Read-only deposit hooks (`useDecimals`, `useWalletBalance`, `useAllowance`)

**Files:**
- Create: `src/hooks/wallet/useDecimals.ts`
- Create: `src/hooks/wallet/useWalletBalance.ts`
- Create: `src/hooks/wallet/useAllowance.ts`

**Interfaces:**
- Consumes: `erc20abi` (Task 2), `ETH_CHAIN_ID`/`ETH_USDC_ADDRESS` (Task 2), `BRIDGE_ADDRESS` (existing, `src/abis/contractABI.ts`), `useAppKitAccount` (existing, `@reown/appkit/react` — same import `GameWallet.tsx`/`WithdrawModal.tsx` already use).
- Produces: `useDecimals(tokenAddress: string): { decimals: number; isLoading: boolean; error: Error | null }`, `useWalletBalance(tokenAddress?: string): { balance: bigint | undefined; isLoading: boolean; isError: boolean }`, `useAllowance(tokenAddress?: string): { allowance: bigint | undefined }` — all default exports from their respective files, consumed by `DepositModal.tsx` in Task 6.

Note: `desktop` doesn't have `ui`'s `useUserWalletConnect` wrapper hook or `FunctionName` enum; these hooks use `@reown/appkit/react`'s `useAppKitAccount` directly (matching `desktop`'s existing `GameWallet.tsx`/`WithdrawModal.tsx` pattern) and literal function-name strings instead of porting an unused enum for four call sites.

- [ ] **Step 1: Create `src/hooks/wallet/useDecimals.ts`**

```ts
import { useState, useEffect } from "react";
import { useReadContract } from "wagmi";
import { erc20abi } from "../../abis/erc20ABI";
import { ETH_CHAIN_ID } from "../../config/constants";

const useDecimals = (tokenAddress: string) => {
    // Initialize to 6 (USDC standard) as fallback while loading
    const [decimals, setDecimals] = useState<number>(6);

    const { data, error, isLoading } = useReadContract({
        address: tokenAddress as `0x${string}`,
        functionName: "decimals",
        abi: erc20abi,
        chainId: ETH_CHAIN_ID,
    });

    useEffect(() => {
        if (data !== undefined) {
            setDecimals(data);
        }
    }, [data]);

    return { decimals, isLoading, error };
};

export default useDecimals;
```

- [ ] **Step 2: Create `src/hooks/wallet/useWalletBalance.ts`**

```ts
import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { erc20abi } from "../../abis/erc20ABI";
import { ETH_CHAIN_ID, ETH_USDC_ADDRESS } from "../../config/constants";

const useWalletBalance = (tokenAddress: string = ETH_USDC_ADDRESS) => {
    const { address } = useAppKitAccount();

    const { data: balance, isLoading, isError } = useReadContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20abi,
        chainId: ETH_CHAIN_ID,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
    });

    return useMemo(() => ({ balance, isLoading, isError }), [balance, isLoading, isError]);
};

export default useWalletBalance;
```

- [ ] **Step 3: Create `src/hooks/wallet/useAllowance.ts`**

```ts
import { useReadContract } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { erc20abi } from "../../abis/erc20ABI";
import { ETH_CHAIN_ID, ETH_USDC_ADDRESS } from "../../config/constants";
import { BRIDGE_ADDRESS } from "../../abis/contractABI";

const useAllowance = (tokenAddress: string = ETH_USDC_ADDRESS) => {
    const { address } = useAppKitAccount();

    const { data: allowance } = useReadContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20abi,
        chainId: ETH_CHAIN_ID,
        functionName: "allowance",
        args: [address as `0x${string}`, BRIDGE_ADDRESS as `0x${string}`],
    });

    return { allowance };
};

export default useAllowance;
```

No unit tests for these three — they are thin `wagmi` read-contract wrappers with no independent logic beyond what `wagmi` itself guarantees, and `ui` (the source being ported from) has no tests for its equivalents either.

- [ ] **Step 4: Verify**

Run: `yarn lint`
Expected: no new errors. `npx tsc --noEmit 2>&1 | grep useDecimals\|useWalletBalance\|useAllowance` should show no errors specific to these three new files (pre-existing unrelated errors from `wagmi`'s own `.d.ts` files, noted in Task 1 Step 6, are expected and not caused by this task).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/wallet/useDecimals.ts src/hooks/wallet/useWalletBalance.ts src/hooks/wallet/useAllowance.ts
git commit -m "feat: add read-only ERC20 hooks for the deposit flow"
```

---

### Task 5: Write hooks (`useApprove`, `useDepositUSDC`)

**Files:**
- Create: `src/hooks/wallet/useApprove.ts`
- Create: `src/hooks/wallet/useDepositUSDC.ts`

**Interfaces:**
- Consumes: `erc20abi` (Task 2), `depositAbi`/`BRIDGE_ADDRESS` (Task 2/existing), `useAppKitAccount` (existing).
- Produces: `useApprove(): { approve: (tokenAddress: string, spender: string, amount: bigint) => Promise<void>; hash: `0x${string}` | undefined; isLoading: boolean; isApprovePending: boolean; isApproveConfirmed: boolean; approveError: Error | null }`, `useDepositUSDC(): { deposit: (amount: bigint, cosmosReceiver: string) => Promise<void>; depositToken: (amount: bigint, cosmosReceiver: string, tokenAddress: string) => Promise<void>; isDepositPending: boolean; isDepositConfirmed: boolean; isPending: boolean; hash: `0x${string}` | undefined; depositError: Error | null }` — both default exports, consumed by `DepositModal.tsx` in Task 6.

Note: `wagmi`'s installed `useWriteContract` in this repo marks `writeContractAsync` as deprecated in favor of `mutateAsync` (confirmed by reading `node_modules/wagmi/dist/types/hooks/useWriteContract.d.ts`) — these hooks use `mutateAsync`, matching `ui`'s existing usage, not `desktop`'s `WithdrawModal.tsx`'s older fire-and-forget `writeContract` (which predates this check and is out of scope to change here).

- [ ] **Step 1: Create `src/hooks/wallet/useApprove.ts`**

```ts
import { useCallback, useMemo } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { erc20abi } from "../../abis/erc20ABI";

const useApprove = () => {
    const { data: hash, isPending, mutateAsync, error } = useWriteContract();
    const { address: userAddress } = useAppKitAccount();

    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

    const approve = useCallback(
        async (tokenAddress: string, spender: string, amount: bigint): Promise<void> => {
            if (!userAddress) {
                throw new Error("Web3 wallet is not connected");
            }

            await mutateAsync({
                address: tokenAddress as `0x${string}`,
                abi: erc20abi,
                functionName: "approve",
                args: [spender as `0x${string}`, amount],
            });
        },
        [userAddress, mutateAsync]
    );

    return useMemo(
        () => ({
            approve,
            hash,
            isLoading: isPending,
            isApprovePending: isConfirming,
            isApproveConfirmed: isConfirmed,
            approveError: error,
        }),
        [approve, hash, isPending, isConfirming, isConfirmed, error]
    );
};

export default useApprove;
```

- [ ] **Step 2: Create `src/hooks/wallet/useDepositUSDC.ts`**

```ts
import { useCallback, useMemo } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { depositAbi, BRIDGE_ADDRESS } from "../../abis/contractABI";

const useDepositUSDC = () => {
    const { data: hash, mutateAsync, isPending, error } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

    // Deposit USDC directly - receiver is a Cosmos address string (e.g. "b521...")
    const deposit = useCallback(
        async (amount: bigint, cosmosReceiver: string): Promise<void> => {
            await mutateAsync({
                address: BRIDGE_ADDRESS as `0x${string}`,
                abi: depositAbi,
                functionName: "depositUnderlying",
                args: [amount, cosmosReceiver],
            });
        },
        [mutateAsync]
    );

    // Deposit any ERC20 token - auto-swaps to USDC if not the underlying token
    const depositToken = useCallback(
        async (amount: bigint, cosmosReceiver: string, tokenAddress: string): Promise<void> => {
            await mutateAsync({
                address: BRIDGE_ADDRESS as `0x${string}`,
                abi: depositAbi,
                functionName: "deposit",
                args: [amount, cosmosReceiver, tokenAddress as `0x${string}`],
            });
        },
        [mutateAsync]
    );

    return useMemo(
        () => ({
            deposit,
            depositToken,
            isDepositPending: isConfirming,
            isDepositConfirmed: isConfirmed,
            isPending,
            hash,
            depositError: error,
        }),
        [deposit, depositToken, isConfirming, isPending, isConfirmed, hash, error]
    );
};

export default useDepositUSDC;
```

No unit tests for these two — same reasoning as Task 4 (thin `wagmi` write-contract wrappers, no independent logic, no equivalent tests in `ui`).

- [ ] **Step 3: Verify**

Run: `yarn lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/wallet/useApprove.ts src/hooks/wallet/useDepositUSDC.ts
git commit -m "feat: add approve and deposit write hooks for the deposit flow"
```

---

### Task 6: `DepositModal` component, wired into `Dashboard`

**Files:**
- Create: `src/components/modal/DepositModal.tsx`
- Create: `src/components/modal/DepositModal.module.css`
- Modify: `src/pages/dashboard/Dashboard.tsx:1-30,74-90` (imports, new state, `onDeposit` wiring, modal render block)

**Interfaces:**
- Consumes: `useDecimals`/`useWalletBalance`/`useAllowance` (Task 4), `useApprove`/`useDepositUSDC` (Task 5), `convertAmountToBigInt` (Task 3), `ETH_USDC_ADDRESS`/`ETH_USDT_ADDRESS` (Task 2), `BRIDGE_ADDRESS` (existing), `useAppKit`/`useAppKitAccount` (existing).
- Produces: `DepositModal` component with props `{ cosmosAddress: string; onClose: () => void; onDepositConfirmed: () => Promise<void> | void }` (default export) — rendered by `Dashboard.tsx`.

- [ ] **Step 1: Create `src/components/modal/DepositModal.module.css`**

```css
.overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    backdrop-filter: blur(3px);
    padding: 16px;
}

.modal {
    background-color: #1f2937;
    border: 1px solid #374151;
    border-radius: 12px;
    padding: 24px;
    width: 100%;
    max-width: 420px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
}

.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
}

.title {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    margin: 0;
}

.closeButton {
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    transition: color 0.15s;
}

.closeButton:hover {
    color: #fff;
}

.hint {
    color: #9ca3af;
    font-size: 13px;
    margin: 0 0 12px;
}

.tokenRow {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
}

.tokenButton,
.tokenButtonSelected {
    flex: 1;
    padding: 10px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
}

.tokenButton {
    background-color: #111827;
    border: 1px solid #374151;
    color: #9ca3af;
}

.tokenButton:hover {
    border-color: #4b5563;
}

.tokenButtonSelected {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    border: 1px solid transparent;
    color: #fff;
}

.balanceBox {
    background-color: #111827;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.balanceLabel {
    color: #9ca3af;
    font-size: 13px;
}

.balanceValue {
    color: #818cf8;
    font-weight: 700;
    font-size: 14px;
}

.field {
    margin-bottom: 16px;
}

.label {
    display: block;
    color: #9ca3af;
    font-size: 12px;
    margin-bottom: 6px;
}

.input {
    width: 100%;
    background-color: #111827;
    border: 1px solid #374151;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    padding: 10px 12px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s;
}

.input:focus {
    border-color: #6366f1;
}

.input::placeholder {
    color: #6b7280;
}

.addressBox {
    background-color: #111827;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 16px;
}

.addressText {
    display: block;
    color: #d1d5db;
    font-family: monospace;
    font-size: 11px;
    word-break: break-all;
    margin-top: 4px;
}

.errorBanner {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    padding: 10px 12px;
    color: #ef4444;
    font-size: 13px;
    margin-bottom: 16px;
}

.actions {
    display: flex;
    gap: 10px;
    margin-top: 4px;
}

.primaryButton {
    flex: 1;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    border: none;
    border-radius: 8px;
    color: #fff;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    padding: 11px 16px;
    transition: opacity 0.15s;
}

.primaryButton:hover {
    opacity: 0.85;
}

.primaryButton:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.cancelButton {
    flex: 1;
    background: transparent;
    border: 1px solid #4b5563;
    border-radius: 8px;
    color: #fff;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    padding: 11px 16px;
    transition: background-color 0.15s;
}

.cancelButton:hover {
    background-color: #374151;
}

.doneText {
    color: #9ca3af;
    font-size: 13px;
    margin: 0 0 20px;
}
```

- [ ] **Step 2: Create `src/components/modal/DepositModal.tsx`**

```tsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { maxUint256 } from "viem";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import useDecimals from "../../hooks/wallet/useDecimals";
import useWalletBalance from "../../hooks/wallet/useWalletBalance";
import useAllowance from "../../hooks/wallet/useAllowance";
import useApprove from "../../hooks/wallet/useApprove";
import useDepositUSDC from "../../hooks/wallet/useDepositUSDC";
import { convertAmountToBigInt } from "../../utils/currency";
import { BRIDGE_ADDRESS } from "../../abis/contractABI";
import { ETH_USDC_ADDRESS, ETH_USDT_ADDRESS } from "../../config/constants";
import styles from "./DepositModal.module.css";

type DepositToken = "USDC" | "USDT";

const TOKEN_ADDRESSES: Record<DepositToken, string> = {
    USDC: ETH_USDC_ADDRESS,
    USDT: ETH_USDT_ADDRESS,
};

interface DepositModalProps {
    cosmosAddress: string;
    onClose: () => void;
    onDepositConfirmed: () => Promise<void> | void;
}

const DepositModal: React.FC<DepositModalProps> = ({ cosmosAddress, onClose, onDepositConfirmed }) => {
    const { open: openAppKit } = useAppKit();
    const { isConnected: isWeb3Connected } = useAppKitAccount();

    const [selectedToken, setSelectedToken] = useState<DepositToken>("USDC");
    const tokenAddress = TOKEN_ADDRESSES[selectedToken];

    const [amount, setAmount] = useState("");
    const [approvedAmount, setApprovedAmount] = useState<bigint>(0n);
    const [error, setError] = useState("");
    const [isDone, setIsDone] = useState(false);

    const { decimals } = useDecimals(tokenAddress);
    const { balance } = useWalletBalance(tokenAddress);
    const { allowance } = useAllowance(tokenAddress);
    const { approve, isLoading: isApproveSubmitting, isApprovePending, isApproveConfirmed, approveError } = useApprove();
    const { deposit, depositToken, isPending: isDepositSubmitting, isDepositPending, isDepositConfirmed, depositError } = useDepositUSDC();

    useEffect(() => {
        if (allowance !== undefined) setApprovedAmount(allowance);
    }, [allowance]);

    useEffect(() => {
        setApprovedAmount(0n);
        setAmount("");
        setError("");
    }, [selectedToken]);

    useEffect(() => {
        if (isApproveConfirmed) setApprovedAmount(maxUint256);
    }, [isApproveConfirmed]);

    useEffect(() => {
        if (isDepositConfirmed) {
            setIsDone(true);
            void onDepositConfirmed();
        }
    }, [isDepositConfirmed, onDepositConfirmed]);

    useEffect(() => {
        if (approveError) setError(approveError.message);
    }, [approveError]);

    useEffect(() => {
        if (depositError) setError(depositError.message);
    }, [depositError]);

    const amountBigInt = useMemo(() => convertAmountToBigInt(amount, decimals), [amount, decimals]);
    const isAllowed = amountBigInt > 0n && approvedAmount >= amountBigInt;
    const isApproving = isApproveSubmitting || isApprovePending;
    const isDepositing = isDepositSubmitting || isDepositPending;

    const handleApprove = useCallback(async () => {
        setError("");
        try {
            await approve(tokenAddress, BRIDGE_ADDRESS, maxUint256);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Approval failed");
        }
    }, [approve, tokenAddress]);

    const handleDeposit = useCallback(async () => {
        setError("");
        try {
            if (selectedToken === "USDC") {
                await deposit(amountBigInt, cosmosAddress);
            } else {
                await depositToken(amountBigInt, cosmosAddress, tokenAddress);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Deposit failed");
        }
    }, [selectedToken, deposit, depositToken, amountBigInt, cosmosAddress, tokenAddress]);

    const handleOverlayClick = useCallback(
        (e: React.MouseEvent) => {
            if (e.target === e.currentTarget) onClose();
        },
        [onClose]
    );

    if (isDone) {
        return (
            <div className={styles.overlay} onClick={handleOverlayClick}>
                <div className={styles.modal}>
                    <div className={styles.header}>
                        <h2 className={styles.title}>Deposit Complete</h2>
                        <button onClick={onClose} className={styles.closeButton}>
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <p className={styles.doneText}>
                        {selectedToken} has been deposited and will appear in your Block52 wallet shortly.
                    </p>
                    <button onClick={onClose} className={styles.primaryButton} style={{ width: "100%" }}>
                        Done
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.overlay} onClick={handleOverlayClick}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Deposit</h2>
                    <button onClick={onClose} className={styles.closeButton}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {!isWeb3Connected ? (
                    <>
                        <p className={styles.hint}>Connect a Web3 wallet to deposit funds.</p>
                        <button onClick={() => openAppKit()} className={styles.primaryButton} style={{ width: "100%" }}>
                            Connect Web3 Wallet
                        </button>
                    </>
                ) : (
                    <>
                        <div className={styles.tokenRow}>
                            <button
                                onClick={() => setSelectedToken("USDC")}
                                className={selectedToken === "USDC" ? styles.tokenButtonSelected : styles.tokenButton}
                            >
                                USDC
                            </button>
                            <button
                                onClick={() => setSelectedToken("USDT")}
                                className={selectedToken === "USDT" ? styles.tokenButtonSelected : styles.tokenButton}
                            >
                                USDT
                            </button>
                        </div>

                        <div className={styles.balanceBox}>
                            <span className={styles.balanceLabel}>Web3 wallet balance</span>
                            <span className={styles.balanceValue}>
                                {balance !== undefined ? (Number(balance) / 10 ** decimals).toFixed(2) : "0.00"} {selectedToken}
                            </span>
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Amount ({selectedToken})</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                min="0"
                                step="0.000001"
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.addressBox}>
                            <span className={styles.hint} style={{ marginBottom: 0 }}>
                                b52{selectedToken} will be minted to your Block52 address:
                            </span>
                            <span className={styles.addressText}>{cosmosAddress}</span>
                        </div>

                        {error && <div className={styles.errorBanner}>{error}</div>}

                        <div className={styles.actions}>
                            <button onClick={onClose} className={styles.cancelButton}>
                                Cancel
                            </button>
                            {isAllowed ? (
                                <button onClick={handleDeposit} disabled={amountBigInt === 0n || isDepositing} className={styles.primaryButton}>
                                    {isDepositing ? "Depositing..." : "Deposit"}
                                </button>
                            ) : (
                                <button onClick={handleApprove} disabled={amountBigInt === 0n || isApproving} className={styles.primaryButton}>
                                    {isApproving ? "Approving..." : "Approve"}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default DepositModal;
```

- [ ] **Step 3: Wire into `Dashboard.tsx`**

Read `src/pages/dashboard/Dashboard.tsx` first. Add the import:

```tsx
import DepositModal from "../../components/modal/DepositModal";
```

Add a new state variable alongside the existing `showSendModal`/`showWithdrawModal`:

```tsx
  const [showDepositModal, setShowDepositModal] = useState(false);
```

Change the `onDeposit` prop passed to `<GameWallet ... />` from `goToWallet` to:

```tsx
            onDeposit={() => setShowDepositModal(true)}
```

Add the modal render block alongside the existing `showSendModal`/`showWithdrawModal` blocks:

```tsx
      {showDepositModal && cosmosAddress && (
        <DepositModal
          cosmosAddress={cosmosAddress}
          onClose={() => setShowDepositModal(false)}
          onDepositConfirmed={refreshBalance}
        />
      )}
```

`goToWallet` stays in the file — `onCreateWallet`/`onImportWallet` still use it to navigate to `/wallet` for the case where no Cosmos wallet exists yet (guarded by the existing `cosmosAddress` check in the JSX above: the deposit modal only renders once a Cosmos address exists).

- [ ] **Step 4: Verify**

Run: `yarn lint`
Expected: no new errors.

Run: `yarn start`, and manually:
1. Generate or confirm a Cosmos wallet exists (via the existing `/wallet` page).
2. Click "Deposit" on the dashboard — the new modal should open (not navigate away).
3. Click "Connect Web3 Wallet" if not already connected — Reown's modal should open (existing, already-working `AppKitProvider` flow).
4. Watch the Electron DevTools console (already opened by `main.ts`'s `openDevTools()` call) while entering an amount and clicking "Approve" / "Deposit" — confirm no `Buffer is not defined` / `process is not defined` / other missing-Node-polyfill errors appear. If any do appear, add the polyfill aliases to `vite.renderer.config.ts` per the spec's "Renderer adjustment" section before proceeding, then re-verify.
5. Full deposit against a real funded Ethereum wallet and live RPC is out of scope to verify in this environment — confirm the UI flow (connect → select token → enter amount → approve → deposit button becomes enabled) behaves correctly up to the point of an actual on-chain transaction.

- [ ] **Step 5: Commit**

```bash
git add src/components/modal/DepositModal.tsx src/components/modal/DepositModal.module.css src/pages/dashboard/Dashboard.tsx
git commit -m "feat: add Web3 deposit modal, wire into dashboard Deposit button"
```

---

## Self-Review Notes

- **Spec coverage:** Toolchain upgrade (Task 1), ERC20/deposit ABI + constants (Task 2), currency conversion + its test (Task 3), read-only hooks (Task 4), write hooks (Task 5), `DepositModal` + `Dashboard` wiring (Task 6) — covers every item in the spec's "Stage 1 file changes" section. BTCPay path and `ProfileAvatarContext` remain explicitly unported, per spec.
- **Renderer polyfills:** the spec leaves this conditional on actual runtime evidence (no pre-emptive `vite.renderer.config.ts` change) — folded into Task 6 Step 4's manual verification rather than a separate task, since the deposit code's dependencies (`wagmi`/`viem`) are the same ones `WithdrawModal.tsx` already runs successfully without polyfills.
- **Type consistency:** `DepositModal.tsx`'s hook destructuring matches the exact return-object keys defined in Tasks 4–5 (`decimals`/`balance`/`allowance` from the read hooks; `approve`/`isLoading`/`isApprovePending`/`isApproveConfirmed`/`approveError` from `useApprove`; `deposit`/`depositToken`/`isPending`/`isDepositPending`/`isDepositConfirmed`/`depositError` from `useDepositUSDC`).
