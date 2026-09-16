import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        // src/utils/convertUtils.test.ts predates this branch and this repo's first test
        // runner; it uses bare Jest-style jest.fn() calls vitest doesn't provide. Porting it
        // to vitest is out of scope here — exclude it until that's done separately.
        exclude: [...configDefaults.exclude, "src/utils/convertUtils.test.ts"],
    },
});
