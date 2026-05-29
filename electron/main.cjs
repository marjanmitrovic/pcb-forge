const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const http = require("node:http");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");

let mainWindow;

const API_PORT = 5174;
const API_URL = `http://localhost:${API_PORT}`;
const PROJECT_ROOT = path.resolve(__dirname, "..");

app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-software-rasterizer");

function checkApiServer() {
  return new Promise((resolve) => {
    const req = http.request(
      `${API_URL}/health`,
      {
        method: "GET",
        timeout: 800,
      },
      (res) => {
        res.resume();
        resolve(true);
      }
    );

    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function startApiServerIfNeeded() {
  const alreadyRunning = await checkApiServer();

  if (alreadyRunning) {
    console.log("PCB Forge Catalog API already running on http://localhost:5174");
    return;
  }

  const serverPath = path.join(PROJECT_ROOT, "server", "index.js");
  console.log("Starting PCB Forge Catalog API from:", serverPath);

  if (!fs.existsSync(serverPath)) {
    console.warn("Catalog API server not found. Continuing without local catalog API.");
    return;
  }

  await import(pathToFileURL(serverPath).href);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1200,
    minHeight: 760,
    title: "PCB Forge",
    backgroundColor: "#0f172a",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const indexPath = path.join(PROJECT_ROOT, "dist", "index.html");
  console.log("Loading:", indexPath);

  if (!fs.existsSync(indexPath)) {
    console.error("Frontend build not found:", indexPath);
    mainWindow.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(`
          <html>
            <body style="font-family: sans-serif; background:#0f172a; color:white; padding:40px">
              <h1>PCB Forge build not found</h1>
              <p>Run <code>npm run build</code> first.</p>
              <p>Expected: ${indexPath}</p>
            </body>
          </html>
        `)
    );
  } else {
    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("Failed to load:", errorCode, errorDescription, validatedURL);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer gone:", details);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await startApiServerIfNeeded();
  } catch (error) {
    console.error("Failed to start PCB Forge Catalog API:", error);
  }

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
