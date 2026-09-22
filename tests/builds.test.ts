import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, readdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareBuild, disposeBuild, safeRelative } from '../src/main/builds';
import { elf, exe, zip } from './fixtures';

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'opendrop-build-test-'));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
const inspect = (filename: string) =>
  prepareBuild(path.join(directory, filename), path.join(directory, 'cache'));

describe('Build inspection', () => {
  it('finds ARM64 APKs and reports their files and size', async () => {
    const data = zip([
      { name: 'AndroidManifest.xml', data: Buffer.from('fixture') },
      { name: 'lib/arm64-v8a/app.so', data: elf() },
    ]);
    await writeFile(path.join(directory, 'app.apk'), data);
    const build = await inspect('app.apk');
    expect(build.info.candidates).toEqual([{ path: 'app.apk', runtime: 'android' }]);
    expect(build.info.bytes).toBe(data.length);
    expect(build.info.fileCount).toBe(1);
  });
  it('accepts APKs with no native libraries', async () => {
    await writeFile(path.join(directory, 'app.apk'), zip([{ name: 'AndroidManifest.xml' }]));
    expect((await inspect('app.apk')).info.candidates[0].runtime).toBe('android');
  });
  it('rejects x86-only APKs', async () => {
    await writeFile(
      path.join(directory, 'app.apk'),
      zip([{ name: 'AndroidManifest.xml' }, { name: 'lib/x86/app.so' }]),
    );
    await expect(inspect('app.apk')).rejects.toThrow('ARM64');
  });
  it('rejects renamed zip files without an Android manifest', async () => {
    await writeFile(path.join(directory, 'app.apk'), zip([{ name: 'readme.txt' }]));
    await expect(inspect('app.apk')).rejects.toThrow('AndroidManifest');
  });
  it('preserves nested launch paths and companion files in a ZIP', async () => {
    await writeFile(
      path.join(directory, 'my-game.zip'),
      zip([
        { name: 'wrapper/bin/game', data: elf(), mode: 0o100755 },
        { name: 'wrapper/data/save.dat', data: Buffer.from('data') },
      ]),
    );
    const build = await inspect('my-game.zip');
    expect(build.info.candidates).toEqual([{ path: 'wrapper/bin/game', runtime: 'linux' }]);
    expect(build.info.fileCount).toBe(2);
    expect(build.files[0].mode).toBe(0o755);
    await disposeBuild(build);
    expect(await readdir(path.join(directory, 'cache'))).toEqual([]);
  });
  it('detects Windows executables and warns about adjacent data', async () => {
    await writeFile(path.join(directory, 'game.exe'), exe());
    const build = await inspect('game.exe');
    expect(build.info.candidates[0].runtime).toBe('windows');
    expect(build.info.warnings.join()).toContain('build folder');
  });
  it('rejects text renamed to an executable', async () => {
    await writeFile(path.join(directory, 'game.exe'), 'not executable');
    await expect(inspect('game.exe')).rejects.toThrow('No supported app');
  });
  it('requires ARM64 Linux executables', async () => {
    await writeFile(path.join(directory, 'game'), elf(62));
    await expect(inspect('game')).rejects.toThrow('No supported app');
  });
  it('offers multiple executable candidates in a folder', async () => {
    await mkdir(path.join(directory, 'build'));
    await writeFile(path.join(directory, 'build/game'), elf());
    await writeFile(path.join(directory, 'build/tools.exe'), exe());
    expect((await inspect('build')).info.candidates).toHaveLength(2);
  });
  it.skipIf(process.platform === 'win32')('rejects links in build folders', async () => {
    await mkdir(path.join(directory, 'build'));
    await writeFile(path.join(directory, 'game'), elf());
    await symlink(path.join(directory, 'game'), path.join(directory, 'build/game'));
    await expect(inspect('build')).rejects.toThrow('Symbolic links');
  });
});

describe('Archive boundaries', () => {
  it.each([
    '../escape',
    '/absolute',
    'C:/escape',
    'folder/../../escape',
    'a\\b',
    'CON.exe',
    'a./game',
    'game:stream',
  ])('rejects unsafe path %s', (name) => {
    expect(() => safeRelative(name)).toThrow();
  });
  it.each([
    [{ name: '../escape', data: elf() }],
    [
      { name: 'Game.exe', data: exe() },
      { name: 'game.exe', data: exe() },
    ],
    [{ name: 'link', mode: 0o120777, data: Buffer.from('/etc/passwd') }],
  ])('rejects unsafe archives and cleans the extraction directory', async (...entries) => {
    await writeFile(path.join(directory, 'bad.zip'), zip(entries));
    await expect(inspect('bad.zip')).rejects.toThrow();
    expect(await readdir(path.join(directory, 'cache'))).toEqual([]);
  });
});
