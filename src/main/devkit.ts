import { Client, utils, type SFTPWrapper } from 'ssh2';
import { createHash } from 'node:crypto';
import { readFile, writeFile, lstat, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { Bonjour } from 'bonjour-service';
import { z } from 'zod';
import type { Device, Job, Runtime } from '../shared/types';
import type { PreparedBuild } from './builds';
import type { Persistence } from './persistence';

const MAGIC = '900b919520e4cf601998a71eec318fec';
export const hostSchema = z
  .string()
  .min(1)
  .max(253)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9.:-]*$/);
export const portSchema = z.number().int().min(1).max(65535);
export const quote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;
export const runtimeSettings = (runtime: Runtime) => ({
  steam_play: runtime === 'windows' ? '1' : '0',
  compat_tool: { android: 'lepton', linux: 'SteamLinuxRuntime_4-arm64', windows: 'proton-stable' }[
    runtime
  ],
});

async function serviceRequest(device: Device, endpoint: string, body?: string): Promise<string> {
  const host = device.host.includes(':') ? `[${device.host}]` : device.host;
  const response = await fetch(`http://${host}:${device.port}/${endpoint}`, {
    method: body ? 'POST' : 'GET',
    body,
    headers: body ? { 'Content-Type': 'text/plain' } : {},
    signal: AbortSignal.timeout(body ? 45_000 : 8_000),
    redirect: 'error',
  });
  if (!response.ok)
    throw new Error(
      `Devkit service returned HTTP ${response.status}. Enable Developer Mode and Pair new host on the headset.`,
    );
  let text = '';
  for await (const chunk of response.body!) {
    text += Buffer.from(chunk).toString('utf8');
    if (text.length > 65_536) throw new Error('Devkit response is too large.');
  }
  return text.trim();
}

export async function discoverDevices(): Promise<Device[]> {
  return new Promise((resolve, reject) => {
    const devices = new Map<string, Device>();
    let bonjour: Bonjour;
    const timer = setTimeout(() => {
      bonjour?.destroy();
      resolve([...devices.values()]);
    }, 4000);
    try {
      bonjour = new Bonjour({}, (error: Error) => {
        clearTimeout(timer);
        bonjour?.destroy();
        reject(error);
      });
      bonjour.find({ type: 'steamos-devkit', protocol: 'tcp' }, (service) => {
        const host = service.addresses?.find((address) => /^\d+\./.test(address)) || service.host;
        if (hostSchema.safeParse(host).success && portSchema.safeParse(service.port).success) {
          devices.set(`${host}:${service.port}`, { host, port: service.port, name: service.name });
        }
      });
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

async function ensureKey(directory: string): Promise<{ private: string; public: string }> {
  const filename = path.join(directory, 'id_ed25519');
  try {
    const privateKey = await readFile(filename, 'utf8');
    const key = utils.parseKey(privateKey);
    if (key instanceof Error || Array.isArray(key)) throw new Error('Invalid OpenDrop SSH key.');
    return { private: privateKey, public: `${key.type} ${key.getPublicSSH().toString('base64')}` };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const keys = await new Promise<{ private: string; public: string }>((resolve, reject) => {
    utils.generateKeyPair('ed25519', {}, (error, keys) => (error ? reject(error) : resolve(keys)));
  });
  await writeFile(filename, keys.private, { mode: 0o600, flag: 'wx' });
  return keys;
}

export class DevkitConnection {
  private client = new Client();
  private sftp!: SFTPWrapper;
  private home = '';
  private helpers = '';
  constructor(
    readonly device: Device,
    private resources: string,
    private store: Persistence,
    private sshPort = 22,
  ) {}

  async connect(
    pair: boolean,
    trust: (device: Device, fingerprint: string) => Promise<boolean>,
    onClose: () => void,
  ): Promise<void> {
    const keys = await ensureKey(this.store.directory);
    if (pair) {
      const response = await serviceRequest(
        this.device,
        'register',
        `${keys.public.trim()} ${MAGIC}\n`,
      );
      try {
        const result = JSON.parse(response);
        if (result.error) throw new Error(String(result.error));
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
    }
    const properties = z
      .object({ login: z.string().regex(/^[a-z_][a-z0-9_-]*[$]?$/i) })
      .parse(JSON.parse(await serviceRequest(this.device, 'properties.json')));
    this.device.username = properties.login;
    const hostId = `${this.device.host}:${this.sshPort}`;
    let fingerprint = '';
    await new Promise<void>((resolve, reject) => {
      this.client.on('error', reject);
      this.client.once('ready', resolve);
      this.client.once('close', () => {
        reject(new Error('The SSH connection closed.'));
        onClose();
      });
      this.client.connect({
        host: this.device.host,
        port: this.sshPort,
        username: properties.login,
        privateKey: keys.private,
        readyTimeout: 20_000,
        keepaliveInterval: 10_000,
        keepaliveCountMax: 3,
        hostVerifier: (key: Buffer, verify: (valid: boolean) => void) => {
          fingerprint = `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`;
          const previous = this.store.hosts[hostId];
          if (previous) {
            verify(previous === fingerprint);
            return;
          }
          void trust(this.device, fingerprint).then(verify, () => verify(false));
        },
      });
    });
    this.store.hosts[hostId] = fingerprint;
    this.device.fingerprint = fingerprint;
    await this.store.save();
    this.sftp = await new Promise((resolve, reject) =>
      this.client.sftp((error, sftp) => (error ? reject(error) : resolve(sftp))),
    );
    this.home = (await this.exec('printf "%s" "$HOME"')).trim();
    if (!this.home.startsWith('/') || /[\r\n\0]/.test(this.home))
      throw new Error('Invalid device home directory.');
    this.helpers = `${this.home}/.local/share/opendrop/devkit-e091c176`;
  }

  exec(command: string, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      signal?.throwIfAborted();
      const timer = setTimeout(() => {
        this.close();
        reject(new Error('The device command timed out.'));
      }, 30_000);
      const abort = () => {
        this.close();
        reject(new Error('Installation cancelled.'));
      };
      signal?.addEventListener('abort', abort, { once: true });
      const finish = (error?: Error, output = '') => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        this.client.off('close', closed);
        error ? reject(error) : resolve(output);
      };
      const closed = () => finish(new Error('The device disconnected.'));
      this.client.once('close', closed);
      this.client.exec(command, (error, stream) => {
        if (error) return finish(error);
        let stdout = '';
        let stderr = '';
        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
          if (stdout.length > 1_048_576) {
            stream.close();
            finish(new Error('Device output limit exceeded.'));
          }
        });
        stream.stderr.on('data', (data: Buffer) => {
          stderr = (stderr + data.toString()).slice(-16_384);
        });
        stream.on('error', finish);
        stream.on('close', (code: number) =>
          finish(
            code === 0 ? undefined : new Error(stderr.trim() || `Device command failed (${code}).`),
            stdout,
          ),
        );
      });
    });
  }

  private async put(
    local: string,
    remote: string,
    mode: number,
    signal?: AbortSignal,
    progress?: (bytes: number) => void,
  ): Promise<void> {
    let idle = setTimeout(() => this.close(), 30_000);
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        progress?.(chunk.length);
        done(null, chunk);
      },
    });
    meter.on('data', () => {
      clearTimeout(idle);
      idle = setTimeout(() => this.close(), 30_000);
    });
    const output = this.sftp.createWriteStream(remote, { mode });
    const closed = () => {
      output.emit('error', new Error('The device disconnected during upload.'));
      output.destroy();
    };
    this.client.once('close', closed);
    try {
      await pipeline(createReadStream(local), meter, output, { signal });
    } finally {
      clearTimeout(idle);
      this.client.off('close', closed);
    }
  }

  private async syncHelpers(signal?: AbortSignal): Promise<void> {
    await this.exec(`mkdir -p ${quote(`${this.helpers}/devkit_utils`)}`, signal);
    for (const filename of [
      'steam-client-create-shortcut',
      'steam-devkit-rpc',
      'devkit_utils/__init__.py',
      'LICENSE',
    ]) {
      await this.put(
        path.join(this.resources, filename),
        `${this.helpers}/${filename}`,
        0o644,
        signal,
      );
    }
  }

  async install(
    build: PreparedBuild,
    job: Job,
    signal: AbortSignal,
    progress: (bytes: number, registering?: boolean) => void,
  ): Promise<void> {
    await this.syncHelpers(signal);
    const destination = `${this.home}/devkit-game/${job.gameId}`;
    await this.exec(
      `mkdir -p ${quote(`${this.home}/devkit-game`)} && mkdir ${quote(destination)}`,
      signal,
    );
    const directories = new Set<string>();
    let transferred = 0;
    for (const file of build.files) {
      signal.throwIfAborted();
      const stat = await lstat(file.absolute);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.size !== file.size ||
        (await realpath(file.absolute)) !== path.resolve(file.absolute)
      ) {
        throw new Error('Build files changed after selection. Select the build again.');
      }
      const remote = `${destination}/${file.relative}`;
      const parent = path.posix.dirname(remote);
      if (!directories.has(parent)) {
        await this.exec(`mkdir -p ${quote(parent)}`, signal);
        directories.add(parent);
      }
      const mode =
        job.runtime === 'linux' && file.relative === job.entrypoint ? 0o755 : file.mode || 0o644;
      await this.put(file.absolute, remote, mode, signal, (bytes) => {
        transferred += bytes;
        progress(transferred);
      });
    }
    signal.throwIfAborted();
    progress(transferred, true);
    const parameters = {
      gameid: job.gameId,
      directory: destination,
      argv: [job.entrypoint],
      env: {},
      settings: runtimeSettings(job.runtime),
      force_appid: '',
    };
    const output = await this.exec(
      `python3 ${quote(`${this.helpers}/steam-client-create-shortcut`)} --parms ${quote(JSON.stringify(parameters))}`,
      signal,
    );
    const result = JSON.parse(output);
    if (result.error || !result.success)
      throw new Error(String(result.error || 'Steam did not confirm shortcut registration.'));
  }

  async launch(gameId: string): Promise<void> {
    await this.syncHelpers();
    await this.exec(
      `python3 ${quote(`${this.helpers}/steam-devkit-rpc`)} run-game ${quote(`gameid=${gameId}`)}`,
    );
  }
  close(): void {
    this.client.end();
    this.client.destroy();
  }
}
