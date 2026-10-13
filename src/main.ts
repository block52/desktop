import { app, BrowserWindow, nativeImage, ipcMain, shell, session } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { buildContentSecurityPolicy, hostsFromUrls } from "./csp";
import { registerWalletIpc } from "./wallet/walletIpc";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

app.setName("Block52");

const iconPath = path.join(__dirname, "../../assets/icon.png");

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
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
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
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

app.whenReady().then(() => {
  registerWalletIpc();

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
      import.meta.env.VITE_PAYMENT_PROXY_URL,
      import.meta.env.VITE_SNG_SCHEDULE_URL,
      import.meta.env.VITE_PROFILE_NFT_INDEXER_URL,
      import.meta.env.VITE_MAINNET_RPC_URL,
    ]),
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
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
