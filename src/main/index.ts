import { app, BrowserWindow, dialog, ipcMain, net, protocol, session } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { OpenDropService } from './service';
import { Persistence } from './persistence';
import { parseInstallLink } from './downloads';

protocol.registerSchemesAsPrivileged([
  { scheme: 'opendrop-app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
app.setName('OpenDrop');
const dataArg = process.argv.find((arg) => arg.startsWith('--data-dir='));
if (dataArg && !app.isPackaged) app.setPath('userData', path.resolve(dataArg.slice(11)));
let window: BrowserWindow | undefined;
let service: OpenDropService | undefined;
let queuedLink: string | undefined;
let quitting = false;
const devUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined;

function receiveLink(value: string): void {
  try {
    parseInstallLink(value);
    if (service) {
      service.state.pendingUrl = value;
      service.publish();
    } else queuedLink = value;
    window?.show();
    window?.focus();
  } catch (error) {
    service?.log(`Install link rejected: ${String(error)}`, 'error');
  }
}

const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
else {
  app.on('second-instance', (_event, argv) => {
    const link = argv.find((arg) => arg.startsWith('opendrop://'));
    if (link) receiveLink(link);
    if (window?.isMinimized()) window.restore();
    window?.show();
    window?.focus();
  });
  app.on('open-url', (event, url) => {
    event.preventDefault();
    receiveLink(url);
  });
  void app
    .whenReady()
    .then(start)
    .catch((error) => {
      dialog.showErrorBox('OpenDrop could not start', String(error));
      app.exit(1);
    });
}

async function start(): Promise<void> {
  const rendererRoot = path.resolve(__dirname, '../renderer');
  protocol.handle('opendrop-app', (request) => {
    const url = new URL(request.url);
    if (url.host !== 'bundle') return new Response('Not found', { status: 404 });
    const file = path.resolve(
      rendererRoot,
      `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`,
    );
    if (!file.startsWith(`${rendererRoot}${path.sep}`))
      return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).href);
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  service = new OpenDropService(
    new Persistence(app.getPath('userData')),
    app.isPackaged
      ? path.join(process.resourcesPath, 'devkit')
      : path.resolve(__dirname, '../../resources/devkit'),
    (state) => {
      if (window && !window.isDestroyed()) window.webContents.send('opendrop:state', state);
    },
    async (device, fingerprint) => {
      const options = {
        type: 'question' as const,
        title: 'Trust this headset?',
        message: `First connection to ${device.host}`,
        detail: `SSH fingerprint:\n${fingerprint}\n\nVerify this fingerprint with your device before trusting it. OpenDrop will reject a changed key on later connections.`,
        buttons: ['Cancel', 'Trust headset'],
        defaultId: 0,
        cancelId: 0,
      };
      return (
        (await (window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options)))
          .response === 1
      );
    },
  );
  await service.init(process.argv.includes('--demo'));
  setupIpc();
  createWindow();
  const link = queuedLink || process.argv.find((arg) => arg.startsWith('opendrop://'));
  if (link) receiveLink(link);
  if (app.isPackaged) app.setAsDefaultProtocolClient('opendrop');
}

function createWindow(): void {
  window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 660,
    title: 'OpenDrop',
    backgroundColor: '#1f212b',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.once('ready-to-show', () => window?.show());
  window.on('closed', () => {
    window = undefined;
  });
  void window.loadURL(devUrl || 'opendrop-app://bundle/index.html');
}

function setupIpc(): void {
  const handlers: Record<string, (...args: any[]) => unknown> = {
    state: () => service!.state,
    mode: (mode) => service!.setMode(mode),
    discover: () => service!.discover(),
    connect: (host, port, pair) => service!.connect(host, port, pair),
    disconnect: () => service!.disconnect(),
    pick: async (folder) => {
      if (typeof folder !== 'boolean') throw new Error('Invalid file picker option.');
      const result = await dialog.showOpenDialog(
        window!,
        folder
          ? { title: 'Choose a build folder', properties: ['openDirectory'] }
          : {
              title: 'Choose a build',
              properties: ['openFile'],
              filters: [{ name: 'Builds', extensions: ['apk', 'zip', 'exe', '*'] }],
            },
      );
      return result.canceled ? null : service!.inspect(result.filePaths[0]);
    },
    inspect: (source) => service!.inspect(source),
    demoBuild: () => service!.demoBuild(),
    download: (url) => service!.download(url),
    install: (request) => service!.install(request),
    cancel: (id) => service!.cancel(id),
    launch: (id) => service!.launch(id),
    discard: (id) => service!.discard(id),
  };
  for (const [name, handler] of Object.entries(handlers)) {
    ipcMain.handle(`opendrop:${name}`, (event, ...args) => {
      const frame = event.senderFrame;
      const expectedOrigin = new URL(devUrl || 'opendrop-app://bundle').origin;
      const trusted =
        frame &&
        event.sender === window?.webContents &&
        frame === event.sender.mainFrame &&
        (devUrl
          ? new URL(frame.url).origin === expectedOrigin
          : frame.url.startsWith('opendrop-app://bundle/'));
      if (!trusted) throw new Error('Untrusted IPC sender.');
      return handler(...args);
    });
  }
}

app.on('activate', () => {
  if (!window && service) createWindow();
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', (event) => {
  if (!quitting && service) {
    event.preventDefault();
    quitting = true;
    void service.shutdown().finally(() => app.quit());
  }
});
