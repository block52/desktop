import { app, BrowserWindow, nativeImage, ipcMain, shell, session } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";

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
  // Set Content-Security-Policy.
  // Vite's dev server requires 'unsafe-eval' for HMR; production builds do not.
  const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;
  const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'";

  // No page may use the camera, microphone, geolocation, notifications etc.
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; " +
          `script-src ${scriptSrc}; ` +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: https: blob:; " +
          "font-src 'self' data: https:; " +
          "connect-src 'self' ws://localhost:* wss://localhost:* http://localhost:* https: wss://relay.walletconnect.org wss://relay.walletconnect.com wss://node1.block52.xyz wss://node.texashodl.net wss://node.tommillerservices.com; " +
          "worker-src 'self' blob:; " +
          "object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'"
        ],
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
