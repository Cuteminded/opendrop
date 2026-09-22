import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OpenDropService } from '../src/main/service';
import { Persistence } from '../src/main/persistence';

let directory: string;
let service: OpenDropService;
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'opendrop-service-test-'));
  service = new OpenDropService(
    new Persistence(directory),
    '',
    () => {},
    async () => false,
  );
  await service.init(true);
});
afterEach(async () => {
  await service.shutdown();
  await rm(directory, { recursive: true, force: true });
});
async function enqueue(name = 'Example') {
  const build = service.demoBuild();
  await service.install({ buildId: build.id, name, entrypoint: build.candidates[0].path });
}

describe('Install queue', () => {
  it('requires a connection and refuses invalid start files', async () => {
    await expect(enqueue()).rejects.toThrow('Connect');
    await service.connect('demo', 32000, false);
    await expect(
      service.install({ buildId: service.demoBuild().id, name: 'Game', entrypoint: '../escape' }),
    ).rejects.toThrow('valid build');
  });
  it('processes queued installs in sequence and persists successful history', async () => {
    await service.connect('demo', 32000, false);
    await enqueue('First');
    await enqueue('Second');
    expect(service.state.jobs.map((job) => job.status)).toEqual(['queued', 'uploading']);
    await vi.waitFor(
      () => expect(service.state.jobs.every((job) => job.status === 'installed')).toBe(true),
      { timeout: 8000 },
    );
    const saved = JSON.parse(await readFile(path.join(directory, 'state.json'), 'utf8'));
    expect(saved.jobs).toHaveLength(2);
    expect(saved.jobs.every((job: { mode: string }) => job.mode === 'demo')).toBe(true);
  });
  it('cancels queued and active jobs without recording an installation', async () => {
    await service.connect('demo', 32000, false);
    await enqueue('First');
    await enqueue('Second');
    await service.cancel(service.state.jobs[0].id);
    await service.cancel(service.state.jobs[1].id);
    await vi.waitFor(() =>
      expect(service.state.jobs.every((job) => job.status === 'cancelled')).toBe(true),
    );
  });
  it('blocks mode changes and disconnects during a transfer', async () => {
    await service.connect('demo', 32000, false);
    await enqueue();
    await expect(service.setMode('device')).rejects.toThrow('Wait');
    expect(() => service.disconnect()).toThrow('Cancel');
    await service.cancel(service.state.jobs[0].id);
    await vi.waitFor(() => expect(service.state.jobs[0].status).toBe('cancelled'));
  });
  it('keeps simulator builds out of real installations', async () => {
    const build = service.demoBuild();
    await service.setMode('device');
    expect(() => service.demoBuild()).toThrow('test mode');
    expect(service.state.connected).toBeUndefined();
    await service.setMode('demo');
    await service.connect('demo', 32000, false);
    await expect(
      service.install({
        buildId: build.id,
        name: 'Old sample',
        entrypoint: build.candidates[0].path,
      }),
    ).rejects.toThrow('valid build');
  });
  it('marks interrupted jobs as failed when reopening', async () => {
    await service.connect('demo', 32000, false);
    await enqueue();
    const restored = new Persistence(directory);
    await restored.load();
    expect(restored.jobs[0].status).toBe('failed');
    expect(restored.jobs[0].error).toContain('closed');
    await service.cancel(service.state.jobs[0].id);
    await vi.waitFor(() => expect(service.state.jobs[0].status).toBe('cancelled'));
  });
  it('does not silently overwrite corrupt state', async () => {
    await writeFile(path.join(directory, 'state.json'), '{invalid');
    await expect(new Persistence(directory).load()).rejects.toThrow('backup');
  });
});
