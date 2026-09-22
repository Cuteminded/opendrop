import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import type { AppState, Build, Device, InstallRequest, Job, Mode } from '../shared/types';
import { disposeBuild, prepareBuild, type PreparedBuild } from './builds';
import { DevkitConnection, discoverDevices, hostSchema, portSchema } from './devkit';
import { downloadBuild } from './downloads';
import { Persistence } from './persistence';

export class OpenDropService {
  state: AppState = { mode: 'device', devices: [], jobs: [], logs: [] };
  private builds = new Map<string, PreparedBuild>();
  private connection?: DevkitConnection;
  private active?: { job: Job; abort: AbortController; done: Promise<void> };
  private pending: { job: Job; build: PreparedBuild }[] = [];
  constructor(
    private store: Persistence,
    private resources: string,
    private emit: (state: AppState) => void,
    private trust: (device: Device, fingerprint: string) => Promise<boolean>,
  ) {}

  async init(demo: boolean): Promise<void> {
    await this.store.load();
    this.state.jobs = this.store.jobs;
    if (demo) this.state.mode = 'demo';
    this.log('OpenDrop is ready.');
  }
  publish(): void {
    this.emit(structuredClone(this.state));
  }
  log(message: string, level: 'info' | 'error' = 'info'): void {
    this.state.logs = [
      ...this.state.logs.slice(-199),
      { time: new Date().toISOString(), message, level },
    ];
    this.publish();
  }
  private assertIdle(): void {
    if (this.active || this.pending.length || this.state.busy)
      throw new Error('Wait for the current operation to finish.');
  }
  async operation<T>(label: string, action: () => Promise<T>): Promise<T> {
    if (this.state.busy) throw new Error('Another operation is in progress.');
    this.state.busy = label;
    this.publish();
    try {
      return await action();
    } catch (error) {
      this.log(error instanceof Error ? error.message : String(error), 'error');
      throw error;
    } finally {
      this.state.busy = undefined;
      this.publish();
    }
  }
  async setMode(mode: Mode): Promise<void> {
    this.assertIdle();
    z.enum(['device', 'demo']).parse(mode);
    this.disconnect();
    for (const build of this.builds.values()) await disposeBuild(build);
    this.builds.clear();
    this.state.mode = mode;
    this.state.devices = [];
    this.log(
      mode === 'demo'
        ? 'Test mode enabled. No headset connection or upload will be made.'
        : 'Device mode enabled.',
    );
  }
  async discover(): Promise<void> {
    await this.operation('Looking for headsets', async () => {
      this.state.devices =
        this.state.mode === 'demo'
          ? [{ host: 'demo', port: 32000, name: 'Steam Frame simulator' }]
          : await discoverDevices();
      this.log(
        `${this.state.devices.length} headset${this.state.devices.length === 1 ? '' : 's'} found.`,
      );
    });
  }
  async connect(host: string, port: number, pair: boolean): Promise<void> {
    this.assertIdle();
    hostSchema.parse(host);
    portSchema.parse(port);
    z.boolean().parse(pair);
    await this.operation(
      pair ? 'Confirm pairing on your headset' : 'Connecting to headset',
      async () => {
        this.disconnect();
        const device: Device = {
          host,
          port,
          name: this.state.devices.find((d) => d.host === host)?.name || host,
        };
        if (this.state.mode === 'demo') {
          this.state.connected = { host: 'demo', port: 32000, name: 'Steam Frame simulator' };
        } else {
          const connection = new DevkitConnection(device, this.resources, this.store);
          this.connection = connection;
          try {
            await connection.connect(pair, this.trust, () => {
              if (this.connection === connection) {
                this.connection = undefined;
                this.state.connected = undefined;
                this.log('Headset disconnected.');
              }
            });
            this.state.connected = device;
          } catch (error) {
            connection.close();
            this.connection = undefined;
            throw error;
          }
        }
        this.log(`Connected to ${this.state.connected.name}.`);
      },
    );
  }
  disconnect(): void {
    if (this.active || this.pending.length)
      throw new Error('Cancel pending installations before disconnecting.');
    this.connection?.close();
    this.connection = undefined;
    this.state.connected = undefined;
    this.publish();
  }
  async inspect(source: string): Promise<Build> {
    return this.operation('Checking build files', async () =>
      this.remember(
        await prepareBuild(
          z.string().max(4096).parse(source),
          path.join(this.store.directory, 'cache'),
        ),
      ),
    );
  }
  async download(url: string): Promise<Build> {
    return this.operation('Downloading and checking build', async () => {
      const build = await downloadBuild(
        z.string().max(8192).parse(url),
        path.join(this.store.directory, 'cache'),
      );
      this.state.pendingUrl = undefined;
      return this.remember(build);
    });
  }
  private remember(build: PreparedBuild): Build {
    this.builds.set(build.info.id, build);
    return build.info;
  }
  demoBuild(): Build {
    if (this.state.mode !== 'demo')
      throw new Error('Sample builds are only available in test mode.');
    return this.remember({
      info: {
        id: randomUUID(),
        name: 'Orbit playground',
        source: 'Built-in sample, no files will be transferred',
        bytes: 128 * 1024 ** 2,
        fileCount: 24,
        candidates: [
          { path: 'orbit.apk', runtime: 'android' },
          { path: 'orbit-linux-arm64', runtime: 'linux' },
          { path: 'Orbit.exe', runtime: 'windows' },
        ],
        warnings: [],
      },
      files: [],
    });
  }
  async discard(id: string): Promise<void> {
    const build = this.builds.get(id);
    if (build) {
      this.builds.delete(id);
      await disposeBuild(build);
    }
  }
  async install(request: InstallRequest): Promise<void> {
    const input = z
      .object({
        buildId: z.string().uuid(),
        name: z.string().trim().min(1).max(80),
        entrypoint: z.string().min(1).max(4096),
      })
      .parse(request);
    if (!this.state.connected) throw new Error('Connect a headset first.');
    const build = this.builds.get(input.buildId);
    const candidate = build?.info.candidates.find(
      (candidate) => candidate.path === input.entrypoint,
    );
    if (!build || !candidate) throw new Error('Select a valid build and entry point.');
    const id = randomUUID();
    const gameId = `opendrop-${input.name.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40)}-${id.slice(0, 8)}`;
    const job: Job = {
      id,
      name: input.name,
      runtime: candidate.runtime,
      entrypoint: candidate.path,
      bytes: build.info.bytes,
      transferred: 0,
      status: 'queued',
      device: this.state.connected.host,
      mode: this.state.mode,
      createdAt: new Date().toISOString(),
      gameId,
    };
    this.state.jobs.unshift(job);
    try {
      await this.store.save();
    } catch (error) {
      this.state.jobs.splice(this.state.jobs.indexOf(job), 1);
      throw error;
    }
    this.builds.delete(input.buildId);
    this.pending.push({ job, build });
    this.publish();
    void this.runQueue();
  }
  private async runQueue(): Promise<void> {
    if (this.active) return;
    const item = this.pending.shift();
    if (!item) return;
    const { job, build } = item;
    let finish!: () => void;
    const done = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const abort = new AbortController();
    this.active = { job, abort, done };
    job.status = 'uploading';
    this.log(`Installing ${job.name}${job.mode === 'demo' ? ' in test mode' : ''}.`);
    try {
      if (job.mode === 'demo') {
        for (let i = 1; i <= 20; i++) {
          await delay(120, undefined, { signal: abort.signal });
          job.transferred = Math.round((job.bytes * i) / 20);
          this.publish();
        }
        job.status = 'registering';
        this.publish();
        await delay(450, undefined, { signal: abort.signal });
      } else {
        if (!this.connection || this.state.connected?.host !== job.device)
          throw new Error('The headset disconnected. Connect and select the build again.');
        let lastProgress = 0;
        await this.connection.install(build, job, abort.signal, (bytes, registering) => {
          job.transferred = bytes;
          if (registering) job.status = 'registering';
          if (registering || Date.now() - lastProgress > 100) {
            this.publish();
            lastProgress = Date.now();
          }
        });
      }
      job.status = 'installed';
      this.log(`${job.name}: ${job.mode === 'demo' ? 'simulation complete' : 'added to Steam'}.`);
    } catch (error) {
      job.status = abort.signal.aborted ? 'cancelled' : 'failed';
      job.error = abort.signal.aborted
        ? 'Installation cancelled.'
        : error instanceof Error
          ? error.message
          : String(error);
      if (job.mode === 'device')
        job.error += ` Partial files may remain in ~/devkit-game/${job.gameId}.`;
      this.log(`${job.name}: ${job.error}`, 'error');
    } finally {
      try {
        await disposeBuild(build);
        await this.store.save();
      } catch (error) {
        this.log(`Could not save history or clean temporary files: ${String(error)}`, 'error');
      }
      this.active = undefined;
      this.publish();
      finish();
      void this.runQueue();
    }
  }
  async cancel(id: string): Promise<void> {
    if (this.active?.job.id === id) {
      this.active.abort.abort();
      return;
    }
    const index = this.pending.findIndex((item) => item.job.id === id);
    if (index < 0) return;
    const [item] = this.pending.splice(index, 1);
    item.job.status = 'cancelled';
    await disposeBuild(item.build);
    await this.store.save();
    this.publish();
  }
  async launch(id: string): Promise<void> {
    this.assertIdle();
    const job = this.state.jobs.find((job) => job.id === id && job.status === 'installed');
    if (
      !job ||
      !this.state.connected ||
      job.mode !== this.state.mode ||
      job.device !== this.state.connected.host
    )
      throw new Error('Connect the headset used for this installation.');
    await this.operation('Launching app', async () => {
      if (job.mode === 'device') {
        if (!this.connection) throw new Error('The headset is disconnected.');
        await this.connection.launch(job.gameId);
      }
      this.log(
        job.mode === 'demo' ? `Simulated launch: ${job.name}.` : `Launch requested: ${job.name}.`,
      );
    });
  }
  async shutdown(): Promise<void> {
    for (const item of this.pending.splice(0)) {
      item.job.status = 'cancelled';
      await disposeBuild(item.build);
    }
    const done = this.active?.done;
    this.active?.abort.abort();
    this.connection?.close();
    await done;
    for (const build of this.builds.values()) await disposeBuild(build);
    await this.store.save();
  }
}
