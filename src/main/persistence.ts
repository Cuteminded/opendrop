import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Job } from '../shared/types';

const persisted = z.object({
  hosts: z.record(z.string(), z.string()),
  jobs: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      runtime: z.enum(['android', 'linux', 'windows']),
      entrypoint: z.string(),
      bytes: z.number(),
      transferred: z.number(),
      status: z.enum(['queued', 'uploading', 'registering', 'installed', 'failed', 'cancelled']),
      error: z.string().optional(),
      device: z.string(),
      mode: z.enum(['demo', 'device']),
      createdAt: z.string(),
      gameId: z.string(),
    }),
  ),
});

export class Persistence {
  hosts: Record<string, string> = {};
  jobs: Job[] = [];
  private pending = Promise.resolve();
  constructor(readonly directory: string) {}
  async load(): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    try {
      const data = persisted.parse(
        JSON.parse(await readFile(path.join(this.directory, 'state.json'), 'utf8')),
      );
      this.hosts = data.hosts;
      this.jobs = data.jobs.map((job) =>
        ['queued', 'uploading', 'registering'].includes(job.status)
          ? {
              ...job,
              status: 'failed',
              error: 'OpenDrop closed before installation completed. Add the build again to retry.',
            }
          : job,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error(
          'OpenDrop could not read its saved state. Keep a backup of state.json before resetting it.',
        );
    }
  }
  save(): Promise<void> {
    const content = JSON.stringify({ hosts: this.hosts, jobs: this.jobs }, null, 2);
    this.pending = this.pending
      .catch(() => {})
      .then(async () => {
        const filename = path.join(this.directory, 'state.json');
        await writeFile(`${filename}.tmp`, content, { mode: 0o600 });
        await rename(`${filename}.tmp`, filename);
      });
    return this.pending;
  }
}
