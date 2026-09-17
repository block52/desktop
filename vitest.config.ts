import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        exclude: [
            ...configDefaults.exclude,
            // Nested git worktrees (e.g. .worktrees/<name>/) contain a full copy of the repo;
            // without this, running from the main checkout double-discovers every test file
            // any worktree happens to have checked out.
            "**/.worktrees/**",
            // src/utils/convertUtils.test.ts predates this branch and this repo's first test
            // runner; it uses bare Jest-style jest.fn() calls vitest doesn't provide. Porting it
            // to vitest is out of scope here — exclude it until that's done separately.
            "**/convertUtils.test.ts",
        ],
    },
});
