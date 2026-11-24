import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import MakerAppImage from "@reforged/maker-appimage";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { sidecarBinaryName } from "./src/wallet/sidecarBinary";

// The Go wallet sidecar for the platform being built on (b52-wallet.exe on Windows). The app looks for this same name.
const SIDECAR_BINARY = sidecarBinaryName(process.platform);

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: "./assets/icon",
    // The executable inside every package. Without it the packager names it after productName while the
    // deb/rpm makers look for the package.json name, which fails the Linux build.
    executableName: "block52",
    // The Go wallet sidecar binary, bundled next to the app (process.resourcesPath). Built by the
    // generateAssets hook below. src/wallet/goSidecar.ts resolves it there when packaged.
    extraResource: [`./sidecar/dist/${SIDECAR_BINARY}`],
  },
  rebuildConfig: {},
  hooks: {
    // Build the Go wallet sidecar before packaging, so extraResource finds it. It is built for the machine doing the
    // packaging: CI builds each platform on its own runner (release.yml). CGO is off (the sidecar is pure Go) so the
    // binary has no C library dependency, and -trimpath keeps the build machine's paths out of it.
    generateAssets: async () => {
      execFileSync("go", ["build", "-trimpath", "-o", `dist/${SIDECAR_BINARY}`, "."], {
        cwd: path.join(__dirname, "sidecar"),
        stdio: "inherit",
        env: { ...process.env, CGO_ENABLED: "0" },
      });
    },
    // Electron ships ad-hoc signed, and renaming the executable and editing Info.plist breaks that signature.
    // On Apple Silicon a broken signature plus the download quarantine shows "is damaged and can't be opened",
    // with no way to open it from the dialog. Re-signing ad hoc makes it the usual unsigned-app prompt instead
    // (right-click > Open). A real Developer ID signature replaces this once the app is notarized.
    postPackage: async (_config, options) => {
      if (options.platform !== "darwin") return;
      for (const outputPath of options.outputPaths) {
        for (const entry of readdirSync(outputPath)) {
          if (!entry.endsWith(".app")) continue;
          execFileSync("codesign", ["--force", "--deep", "--sign", "-", path.join(outputPath, entry)], { stdio: "inherit" });
        }
      }
    },
  },
  makers: [
    // Windows: Squirrel .exe installer (also emits the RELEASES/.nupkg auto-update feed).
    new MakerSquirrel({}),
    // macOS: a drag-to-Applications .dmg. This replaces the old .zip — note Squirrel.Mac
    // auto-update pulls a .zip, so in-app auto-update on macOS would need a MakerZIP back
    // (there is no tested macOS auto-update path yet, so the .dmg alone is fine for now).
    new MakerDMG({}, ["darwin"]),
    // Linux: native packages for deb/rpm distros, plus a portable AppImage that runs anywhere.
    new MakerRpm({ options: { bin: "block52" } }),
    new MakerDeb({ options: { bin: "block52" } }),
    new MakerAppImage({ options: { bin: "block52" } }),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
