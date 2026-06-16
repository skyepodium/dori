import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { GitService } from './git/service';
import { registerGitIpcHandlers } from './ipc';

const isLocalDevelopmentRendererUrl = (rendererUrl: string): boolean => {
  if (app.isPackaged) {
    return false;
  }

  try {
    const parsedUrl = new URL(rendererUrl);
    const isLocalHost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
    return parsedUrl.protocol === 'http:' && isLocalHost;
  } catch (error: unknown) {
    return false;
  }
};

const createWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;

  if (rendererUrl !== undefined && isLocalDevelopmentRendererUrl(rendererUrl)) {
    void mainWindow.loadURL(rendererUrl);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
};

const bootstrap = (): void => {
  registerGitIpcHandlers(ipcMain, new GitService());

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
};

bootstrap();
