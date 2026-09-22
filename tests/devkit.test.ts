import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Server, utils } from 'ssh2';
import { createServer, type Server as HttpServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { DevkitConnection, quote, runtimeSettings } from '../src/main/devkit';
import { Persistence } from '../src/main/persistence';
import { prepareBuild } from '../src/main/builds';
import type { Job } from '../src/shared/types';
import { elf } from './fixtures';

let directory: string;
let http: HttpServer;
let ssh: Server;
let connection: DevkitConnection;
let pairingBody: string;
let commands: string[];
let uploads: Map<string, Buffer>;
let registrationError: boolean;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'opendrop-ssh-test-'));
  pairingBody = '';
  commands = [];
  uploads = new Map();
  registrationError = false;
  http = createServer((req, res) => {
    if (req.url === '/properties.json') {
      res.end(JSON.stringify({ login: 'frame' }));
      return;
    }
    if (req.url === '/register') {
      req.on('data', (chunk) => {
        pairingBody += chunk.toString();
      });
      req.on('end', () => res.end('{"success":true}'));
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(0, '127.0.0.1', resolve);
  });
  const keys = utils.generateKeyPairSync('ed25519', {});
  ssh = new Server({ hostKeys: [keys.private] }, (client) => {
    client.on('error', () => {});
    client.on('authentication', (ctx) =>
      ctx.method === 'publickey' ? ctx.accept() : ctx.reject(),
    );
    client.on('session', (accept) => {
      const session = accept();
      session.on('exec', (accept, _reject, info) => {
        const stream = accept();
        commands.push(info.command);
        if (info.command.startsWith('printf')) stream.write('/home/frame');
        if (info.command.includes('steam-client-create-shortcut')) {
          stream.write(
            JSON.stringify(
              registrationError ? { error: 'Steam is not running.' } : { success: 'Registered' },
            ),
          );
        }
        stream.exit(0);
        stream.end();
      });
      session.on('sftp', (accept) => {
        const sftp = accept();
        const handles = new Map<number, string>();
        let next = 0;
        sftp.on('OPEN', (id, filename) => {
          const handle = Buffer.alloc(4);
          handle.writeUInt32BE(++next);
          handles.set(next, filename);
          uploads.set(filename, Buffer.alloc(0));
          sftp.handle(id, handle);
        });
        sftp.on('WRITE', (id, handle, offset, data) => {
          const filename = handles.get(handle.readUInt32BE())!;
          const previous = uploads.get(filename)!;
          const output = Buffer.alloc(Math.max(previous.length, offset + data.length));
          previous.copy(output);
          data.copy(output, offset);
          uploads.set(filename, output);
          sftp.status(id, 0);
        });
        sftp.on('CLOSE', (id, handle) => {
          handles.delete(handle.readUInt32BE());
          sftp.status(id, 0);
        });
      });
    });
  });
  await new Promise<void>((resolve, reject) => {
    ssh.once('error', reject);
    ssh.listen(0, '127.0.0.1', resolve);
  });
  const store = new Persistence(directory);
  await store.load();
  connection = new DevkitConnection(
    { host: '127.0.0.1', port: (http.address() as AddressInfo).port, name: 'Protocol fixture' },
    path.resolve('resources/devkit'),
    store,
    (ssh.address() as AddressInfo).port,
  );
});
afterEach(async () => {
  connection?.close();
  http?.closeAllConnections();
  await Promise.all([
    new Promise<void>((resolve) => (ssh ? ssh.close(() => resolve()) : resolve())),
    new Promise<void>((resolve) => (http ? http.close(() => resolve()) : resolve())),
  ]);
  await rm(directory, { recursive: true, force: true });
});
async function install() {
  await writeFile(path.join(directory, 'app'), elf());
  const build = await prepareBuild(path.join(directory, 'app'), path.join(directory, 'cache'));
  const job: Job = {
    id: 'fixture',
    name: 'Fixture',
    runtime: 'linux',
    entrypoint: 'app',
    bytes: 128,
    transferred: 0,
    status: 'uploading',
    device: '127.0.0.1',
    mode: 'device',
    gameId: 'opendrop-fixture',
    createdAt: new Date().toISOString(),
  };
  const progress: number[] = [];
  await connection.install(build, job, new AbortController().signal, (bytes) =>
    progress.push(bytes),
  );
  return progress;
}

describe('Devkit protocol with a local SSH/SFTP server', () => {
  it('pairs, verifies the host, uploads exact bytes and registers the expected runtime', async () => {
    const fingerprints: string[] = [];
    await connection.connect(
      true,
      async (_device, fingerprint) => {
        fingerprints.push(fingerprint);
        return true;
      },
      () => {},
    );
    expect(pairingBody).toMatch(/^ssh-ed25519 [A-Za-z0-9+/=]+ 900b919520e4cf601998a71eec318fec\n$/);
    expect(fingerprints).toHaveLength(1);
    const saved = JSON.parse(await readFile(path.join(directory, 'state.json'), 'utf8'));
    expect(Object.values(saved.hosts)).toEqual(fingerprints);
    const progress = await install();
    expect(uploads.get('/home/frame/devkit-game/opendrop-fixture/app')).toEqual(elf());
    expect(progress.at(-1)).toBe(128);
    const command = commands.find((command) => command.includes('steam-client-create-shortcut'))!;
    expect(command).toContain('"compat_tool":"SteamLinuxRuntime_4-arm64"');
    expect(command).toContain('"argv":["app"]');
    expect(uploads.size).toBe(5);
  });
  it('does not report a successful installation when Steam rejects registration', async () => {
    await connection.connect(
      false,
      async () => true,
      () => {},
    );
    registrationError = true;
    await expect(install()).rejects.toThrow('Steam is not running');
  });
  it('refuses a first connection when the fingerprint is not trusted', async () => {
    await expect(
      connection.connect(
        false,
        async () => false,
        () => {},
      ),
    ).rejects.toThrow();
    expect(uploads.size).toBe(0);
  });
  it('quotes shell metacharacters without interpreting them', () => {
    expect(quote("a'b;$(whoami)")).toBe("'a'\\''b;$(whoami)'");
    expect(runtimeSettings('android')).toEqual({ steam_play: '0', compat_tool: 'lepton' });
    expect(runtimeSettings('windows')).toEqual({ steam_play: '1', compat_tool: 'proton-stable' });
  });
});
