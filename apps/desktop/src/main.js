const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const isDevelopment = process.env.DESKTOP_DEV_SERVER_URL || process.env.NODE_ENV === 'development';
const devServerUrl = process.env.DESKTOP_DEV_SERVER_URL || 'http://127.0.0.1:5173';
const webIndexPath = join(__dirname, '..', '..', 'web', 'dist', 'index.html');
const allowedExternalProtocols = new Set(['https:', 'mailto:']);

let mainWindow = null;

function isAllowedExternalUrl(url) {
  try {
    return allowedExternalProtocols.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

function isTrustedNavigationUrl(url) {
  try {
    const parsed = new URL(url);
    const devServer = new URL(devServerUrl);

    if (parsed.protocol === 'file:') {
      return !isDevelopment;
    }

    return isDevelopment && parsed.origin === devServer.origin;
  } catch {
    return false;
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: '智能人事客户端',
    backgroundColor: '#f7faf9',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedNavigationUrl(url)) {
      event.preventDefault();
    }
  });

  if (isDevelopment) {
    mainWindow.loadURL(devServerUrl);
  } else if (existsSync(webIndexPath)) {
    mainWindow.loadFile(webIndexPath);
  } else {
    dialog.showErrorBox('客户端启动失败', '未找到前端构建产物，请先完成前端构建。');
    app.quit();
  }
}

function createMenu() {
  const template = [
    {
      label: '应用',
      submenu: [
        { label: '刷新', role: 'reload' },
        { label: '强制刷新', role: 'forceReload' },
        { type: 'separator' },
        { label: '退出', role: 'quit' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '关闭', role: 'close' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '打开项目文档',
          click: () => shell.openPath(join(__dirname, '..', 'README.md')),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('desktop:get-runtime', () => ({
  platform: process.platform,
  version: app.getVersion(),
  name: '智能人事客户端',
}));

app.whenReady().then(() => {
  createMenu();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
