import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, mkdtemp, open, readdir, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { randomUUID } from 'node:crypto';
import yauzl, { type Entry, type ZipFile } from 'yauzl';
import type { Build, Candidate } from '../shared/types';

const MAX_BYTES = 32 * 1024 ** 3;
const MAX_FILES = 50_000;
export interface BuildFile {
  absolute: string;
  relative: string;
  size: number;
  mode: number;
}
export interface PreparedBuild {
  info: Build;
  files: BuildFile[];
  temporary?: string;
}

export function safeRelative(value: string): string {
  const parts = value.replace(/\/$/, '').split('/');
  if (
    !value ||
    value.includes('\\') ||
    parts.some(
      (p) =>
        !p ||
        p === '.' ||
        p === '..' ||
        /[<>:"|?*\x00-\x1f]/.test(p) ||
        /[. ]$/.test(p) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(p),
    )
  ) {
    throw new Error(`Unsupported or unsafe file path: ${value}`);
  }
  return parts.join('/');
}

export async function visitZip(
  filename: string,
  visit: (zip: ZipFile, entry: Entry) => Promise<void>,
): Promise<void> {
  const zip = await new Promise<ZipFile>((resolve, reject) => {
    yauzl.open(filename, { lazyEntries: true, strictFileNames: true }, (err, value) =>
      err ? reject(err) : resolve(value!),
    );
  });
  await new Promise<void>((resolve, reject) => {
    let bytes = 0;
    let count = 0;
    const names = new Set<string>();
    const fail = (err: unknown) => {
      zip.close();
      reject(err);
    };
    zip.on('error', fail);
    zip.on('end', resolve);
    zip.on('entry', (entry: Entry) => {
      void (async () => {
        const name = safeRelative(entry.fileName).normalize('NFC').toLowerCase();
        if (names.has(name)) throw new Error('The archive contains duplicate file names.');
        names.add(name);
        if ((entry.generalPurposeBitFlag & 1) !== 0)
          throw new Error('Encrypted archives are not supported.');
        if (((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000)
          throw new Error('Symbolic links are not supported.');
        bytes += entry.uncompressedSize;
        if (++count > MAX_FILES || bytes > MAX_BYTES)
          throw new Error('The archive exceeds the 50,000 file or 32 GiB limit.');
        await visit(zip, entry);
        zip.readEntry();
      })().catch(fail);
    });
    zip.readEntry();
  });
}

async function extractZip(filename: string, destination: string): Promise<void> {
  let total = 0;
  await visitZip(filename, async (zip, entry) => {
    const target = path.join(destination, safeRelative(entry.fileName));
    if (entry.fileName.endsWith('/')) {
      await mkdir(target, { recursive: true });
      return;
    }
    await mkdir(path.dirname(target), { recursive: true });
    const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => {
      zip.openReadStream(entry, (err, stream) => (err ? reject(err) : resolve(stream!)));
    });
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        total += chunk.length;
        done(total > MAX_BYTES ? new Error('Extracted content exceeds 32 GiB.') : null, chunk);
      },
    });
    const mode = (entry.externalFileAttributes >>> 16) & 0o777;
    await pipeline(stream, limit, createWriteStream(target, { flags: 'wx', mode: mode || 0o644 }));
  });
}

async function collectFiles(
  root: string,
  base = root,
  files: BuildFile[] = [],
): Promise<BuildFile[]> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (['.git', '.codex', '.agents', '.DS_Store', '__MACOSX'].includes(entry.name)) continue;
    const absolute = path.join(root, entry.name);
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not supported: ${entry.name}`);
    if (stat.isDirectory()) await collectFiles(absolute, base, files);
    else if (stat.isFile())
      files.push({
        absolute,
        relative: safeRelative(path.relative(base, absolute).split(path.sep).join('/')),
        size: stat.size,
        mode: stat.mode & 0o777,
      });
    else throw new Error(`Unsupported file: ${entry.name}`);
    if (files.length > MAX_FILES) throw new Error('A build can contain at most 50,000 files.');
  }
  return files;
}

async function detectCandidate(
  file: BuildFile,
  warnings: string[],
): Promise<Candidate | undefined> {
  if (file.relative.toLowerCase().endsWith('.apk')) {
    let manifest = false;
    const abis = new Set<string>();
    await visitZip(file.absolute, async (_zip, entry) => {
      if (entry.fileName === 'AndroidManifest.xml') manifest = true;
      const match = /^lib\/([^/]+)\//.exec(entry.fileName);
      if (match) abis.add(match[1]);
    });
    if (!manifest) throw new Error(`${file.relative} has no AndroidManifest.xml.`);
    if (abis.size && !abis.has('arm64-v8a'))
      throw new Error(`${file.relative} has no ARM64 native libraries.`);
    warnings.push(
      'APK architecture is checked. Store services, signing and VR API compatibility still depend on the app.',
    );
    return { path: file.relative, runtime: 'android' };
  }
  const handle = await open(file.absolute, 'r');
  try {
    const header = Buffer.alloc(64);
    const { bytesRead } = await handle.read(header, 0, 64, 0);
    if (bytesRead >= 20 && header.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70]))) {
      if (
        header[4] === 2 &&
        header[5] === 1 &&
        header.readUInt16LE(18) === 183 &&
        [2, 3].includes(header.readUInt16LE(16)) &&
        !/\.so(\.|$)/i.test(file.relative)
      ) {
        return { path: file.relative, runtime: 'linux' };
      }
    }
    if (
      file.relative.toLowerCase().endsWith('.exe') &&
      bytesRead === 64 &&
      header.toString('ascii', 0, 2) === 'MZ'
    ) {
      const signature = Buffer.alloc(6);
      await handle.read(signature, 0, 6, header.readUInt32LE(60));
      if (signature.readUInt32LE(0) === 0x4550) return { path: file.relative, runtime: 'windows' };
    }
  } finally {
    await handle.close();
  }
}

export async function prepareBuild(source: string, cache: string): Promise<PreparedBuild> {
  if (!path.isAbsolute(source)) throw new Error('Select an absolute file or folder path.');
  const stat = await lstat(source);
  if (stat.isSymbolicLink())
    throw new Error('Select the original file instead of a symbolic link.');
  source = await realpath(source);
  let temporary: string | undefined;
  try {
    let files: BuildFile[];
    const warnings: string[] = [];
    if (stat.isDirectory()) files = await collectFiles(source);
    else if (stat.isFile() && source.toLowerCase().endsWith('.zip')) {
      await mkdir(cache, { recursive: true });
      temporary = await realpath(await mkdtemp(path.join(cache, 'build-')));
      await extractZip(source, temporary);
      files = await collectFiles(temporary);
    } else if (stat.isFile()) {
      files = [
        {
          absolute: source,
          relative: safeRelative(path.basename(source)),
          size: stat.size,
          mode: stat.mode & 0o777,
        },
      ];
      if (source.toLowerCase().endsWith('.exe'))
        warnings.push(
          'Only this executable will be uploaded. Select its build folder if it needs other files.',
        );
    } else throw new Error('Select a file or folder.');
    const bytes = files.reduce((sum, f) => sum + f.size, 0);
    if (bytes > MAX_BYTES) throw new Error('A build can be at most 32 GiB.');
    const candidates: Candidate[] = [];
    for (const file of files) {
      const candidate = await detectCandidate(file, warnings);
      if (candidate) candidates.push(candidate);
    }
    if (!candidates.length)
      throw new Error(
        'No supported app found. Choose an ARM64 APK, an ARM64 Linux ELF binary, or a Windows executable.',
      );
    const name = path
      .basename(source)
      .replace(/\.(apk|zip|exe)$/i, '')
      .replace(/[_-]+/g, ' ');
    return {
      info: {
        id: randomUUID(),
        name,
        source,
        bytes,
        fileCount: files.length,
        candidates,
        warnings: [...new Set(warnings)],
      },
      files,
      temporary,
    };
  } catch (error) {
    if (temporary) await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

export async function disposeBuild(build: PreparedBuild): Promise<void> {
  if (build.temporary) await rm(build.temporary, { recursive: true, force: true });
}

export { createReadStream };
