import { app, BrowserWindow, dialog, Menu, nativeImage, ipcMain, shell, session, protocol, net } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import started from "electron-squirrel-startup";
import { APP_ORIGIN, APP_SCHEME, isOwnResource, resolveAppFile } from "./appProtocol";
import { buildContentSecurityPolicy, hostsFromUrls } from "./csp";
import { registerBinariesIpc } from "./binaries/binariesIpc";
import { registerIndexerIpc } from "./indexer/indexerIpc";
import { registerPlayerNotesIpc } from "./players/playerNotesIpc";
import { registerWalletIpc } from "./wallet/walletIpc";
import { checkForUpdatesFromMenu, registerUpdateIpc } from "./updates/updateIpc";
import { buildMenuTemplate } from "./appMenu";
import { DEEP_LINK_SCHEME, findDeepLink, parseDeepLink } from "./deepLink";
import { DeepLinkInbox } from "./deepLinkInbox";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

app.setName("Block52");

// One window only: a second launch (the OS opening a block52:// link while the app is running) hands its link to this one.
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) {
  app.quit();
}

// block52://table/<id> and block52://tournament/<id> open the app on that page. A link can arrive before the window or
// the page exists, so the inbox holds it until the page says it is listening (see src/deepLinkInbox.ts).
const mainWindowOrNull = () => BrowserWindow.getAllWindows()[0] ?? null;
const deepLinks = new DeepLinkInbox(
  (route) => mainWindowOrNull()?.webContents.send("deeplink:open", route),
  () => {
    const window = mainWindowOrNull();
    if (window === null) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  },
);

// macOS delivers the link as an event, possibly before the app is ready.
app.on("open-url", (event, url) => {
  event.preventDefault();
  const route = parseDeepLink(url);
  if (route !== null) deepLinks.open(route);
});

// Windows and Linux start a second copy with the link on its command line; it quits and this one gets it here.
app.on("second-instance", (_event, argv) => {
  const route = findDeepLink(argv);
  if (route !== null) deepLinks.open(route);
  else mainWindowOrNull()?.focus();
});

// Register as the handler for the scheme. Only a packaged app: from source it would point the OS at electron itself.
if (app.isPackaged) {
  app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
}

// The app was started by a link.
const startupLink = findDeepLink(process.argv);
if (startupLink !== null) deepLinks.open(startupLink);

ipcMain.handle("deeplink:ready", () => deepLinks.rendererReady());

// The packaged app is served from app://block52 rather than file://, so it has a real origin that the
// WalletConnect relay can be told to allow.
protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const iconPath = path.join(__dirname, "../../assets/icon.png");

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    icon: iconPath,
    // macOS: no title bar, the traffic lights sit inside the app (the renderer draws a drag strip under them).
    ...(process.platform === "darwin" ? { titleBarStyle: "hidden" as const, trafficLightPosition: { x: 16, y: 10 } } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // The window only ever shows the app. Links open in the system browser (https only), never in a new
  // Electron window that would inherit the preload bridge, and the page itself can't navigate away.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("did-start-loading", () => deepLinks.rendererGone());
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadURL(`${APP_ORIGIN}/`);
  }

  // DevTools only when running from source (yarn start), never in a packaged build.
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
};

/** Only web links may leave the app: a renderer (or remote data it displays) must not launch file:, smb: or app-protocol URLs. */
function isWebUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

ipcMain.on("open-external", (_event, url: unknown) => {
  if (isWebUrl(url)) {
    void shell.openExternal(url);
  }
});

// Indexer search over GraphQL; the API key stays in this process.
registerIndexerIpc();

// Local player notes/nicknames/tags (SQLite in this process).
registerPlayerNotesIpc();

// Node binary versions + update check (pokerchaind, ws-server).
registerBinariesIpc();

app.whenReady().then(() => {
  const { lockWallet } = registerWalletIpc();
  registerUpdateIpc();

  const targetWindow = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      buildMenuTemplate({
        platform: process.platform,
        appName: app.getName(),
        isDev: !app.isPackaged,
        actions: {
          navigate: (route) => targetWindow()?.webContents.send("menu:navigate", route),
          lockWallet,
          checkForUpdates: () => void checkForUpdatesFromMenu(),
          about: () => {
            const options = { type: "info" as const, message: app.getName(), detail: `Version ${app.getVersion()}`, buttons: ["OK"] };
            const parent = targetWindow();
            void (parent !== undefined ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options));
          },
          openExternal: (url) => {
            if (isWebUrl(url)) void shell.openExternal(url);
          },
        },
      }),
    ),
  );

  // Set Content-Security-Policy.
  // Vite's dev server requires 'unsafe-eval' for HMR; production builds do not.
  const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;

  // No page may use the camera, microphone, geolocation, notifications etc. Writing to the clipboard
  // (the copy buttons) is the one thing the app needs.
  const allowedPermissions = new Set(["clipboard-sanitized-write"]);
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => callback(allowedPermissions.has(permission)));
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => allowedPermissions.has(permission));

  const csp = buildContentSecurityPolicy({
    isDev,
    extraConnectHosts: hostsFromUrls([
      import.meta.env.VITE_INDEXER_URL,
      import.meta.env.VITE_SNG_SCHEDULE_URL,
      import.meta.env.VITE_PROFILE_NFT_INDEXER_URL,
      import.meta.env.VITE_MAINNET_RPC_URL,
    ]),
  });

  if (!isDev) {
    const rendererRoot = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`);
    protocol.handle(APP_SCHEME, async (request) => {
      const file = resolveAppFile(rendererRoot, request.url);
      if (file === null) return new Response("Not found", { status: 404 });
      const response = await net.fetch(pathToFileURL(file).toString());
      const headers = new Headers(response.headers);
      headers.set("Content-Security-Policy", csp);
      return new Response(response.body, { status: response.status, headers });
    });
  }

  // Only the app's own documents get the policy. Stamping it on a third-party response (the WalletConnect
  // verify frame) would add frame-ancestors 'none' to it and stop it loading.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!isOwnResource(details.url, MAIN_WINDOW_VITE_DEV_SERVER_URL)) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });

  if (process.platform === "darwin") {
    app.dock?.setIcon(nativeImage.createFromPath(iconPath));
  }
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
