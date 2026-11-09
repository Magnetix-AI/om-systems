const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('node:path');
const { APP_URL, navigationAction } = require('./navigation.cjs');

let mainWindow;
app.setName('O.M Systems LTD');
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

function secureWindow(window) {
  window.webContents.on('will-navigate', (event, url) => {
    const action = navigationAction(url);
    if (action === 'app') return;
    event.preventDefault();
    if (action === 'external') shell.openExternal(url);
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || navigationAction(url) === 'app') {
      return { action: 'allow', overrideBrowserWindowOptions: {
        width: 1000, height: 800,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
      } };
    }
    if (navigationAction(url) === 'external') shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('did-create-window', child => secureWindow(child));
}

async function loadApp() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    await mainWindow.loadURL(APP_URL);
  } catch {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning', title: 'O.M Systems LTD',
      message: 'לא ניתן להתחבר למערכת',
      detail: 'יש לוודא שהמחשב מחובר לאינטרנט ולנסות שוב.',
      buttons: ['נסה שוב', 'סגור'], defaultId: 0, cancelId: 1,
    });
    if (result.response === 0) loadApp();
    else mainWindow.close();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'O.M Systems LTD', width: 1440, height: 960,
    minWidth: 900, minHeight: 640, show: false,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  secureWindow(mainWindow);
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = details.requestingUrl || webContents.getURL();
    callback(navigationAction(origin) === 'app' && permission === 'notifications');
  });
  mainWindow.on('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = undefined; });
  mainWindow.webContents.on('page-title-updated', event => {
    event.preventDefault();
    mainWindow?.setTitle('O.M Systems LTD');
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'מערכת', submenu: [
      { label: 'רענון', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.webContents.reload() },
      { label: 'פתיחה בדפדפן', click: () => shell.openExternal(APP_URL) },
      { type: 'separator' }, { role: 'quit', label: 'יציאה' },
    ] },
    { label: 'עריכה', submenu: [
      { role: 'undo', label: 'ביטול' }, { role: 'redo', label: 'ביצוע חוזר' },
      { type: 'separator' }, { role: 'cut', label: 'גזירה' },
      { role: 'copy', label: 'העתקה' }, { role: 'paste', label: 'הדבקה' },
      { role: 'selectAll', label: 'בחירת הכל' },
    ] },
    { label: 'תצוגה', submenu: [
      { role: 'resetZoom', label: 'גודל רגיל' }, { role: 'zoomIn', label: 'הגדלה' },
      { role: 'zoomOut', label: 'הקטנה' }, { role: 'togglefullscreen', label: 'מסך מלא' },
    ] },
  ]));
  loadApp();
}

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});
if (singleInstance) app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());