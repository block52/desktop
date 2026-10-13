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
        ],
    },
});
