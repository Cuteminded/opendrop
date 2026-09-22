import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prepareBuild, safeRelative, type PreparedBuild } from './builds';

export function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || b === 2)) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && [18, 19, 51].includes(b)) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (isIP(address) === 6) {
    const first = parseInt(address.split(':')[0], 16);
    return first >= 0x2000 && first <= 0x3fff && !/^200[12]:/i.test(address);
  }
  return false;
}

export function validateDownloadUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== '443')
  ) {
    throw new Error('Use a public HTTPS URL without credentials, fragments or a custom port.');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    (isIP(hostname) && !publicAddress(hostname))
  ) {
    throw new Error('Download links must point to a public internet address.');
  }
  return url;
}

export function parseInstallLink(value: string): { url: string; manifest: boolean } {
  if (!value.startsWith('opendrop:'))
    return { url: validateDownloadUrl(value).href, manifest: /\.json(?:\?|$)/i.test(value) };
  const link = new URL(value);
  if (link.hostname !== 'install' || link.username || link.password)
    throw new Error('Invalid OpenDrop install link.');
  const manifest = link.searchParams.get('manifest');
  const direct = link.searchParams.get('url');
  if (!!manifest === !!direct)
    throw new Error('The install link must include exactly one manifest or file URL.');
  return { url: validateDownloadUrl(manifest || direct!).href, manifest: !!manifest };
}

async function request(value: string, redirects = 0): Promise<import('node:http').IncomingMessage> {
  const url = validateDownloadUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new Error('The download host resolves to a non-public address.');
  const target = addresses[0];
  const response = await new Promise<import('node:http').IncomingMessage>((resolve, reject) => {
    const req = https.get(
      url,
      {
        lookup: (_host, options, callback) => {
          if (typeof options === 'object' && options.all) callback(null, [target]);
          else callback(null, target.address, target.family);
        },
        headers: { 'User-Agent': 'OpenDrop/0.1.0' },
        signal: AbortSignal.timeout(15 * 60_000),
      },
      resolve,
    );
    req.setTimeout(30_000, () => req.destroy(new Error('Download timed out.')));
    req.on('error', reject);
  });
  if ([301, 302, 303, 307, 308].includes(response.statusCode!)) {
    response.destroy();
    if (redirects >= 5 || !response.headers.location)
      throw new Error('Too many download redirects.');
    return request(new URL(response.headers.location, url).href, redirects + 1);
  }
  if (response.statusCode !== 200) {
    response.destroy();
    throw new Error(`Download returned HTTP ${response.statusCode}.`);
  }
  return response;
}

const manifestSchema = z.object({
  schema: z.literal('opendrop.install/v1'),
  name: z.string().trim().min(1).max(80),
  files: z
    .array(
      z.object({
        url: z.string(),
        sha256: z
          .string()
          .regex(/^[a-f0-9]{64}$/i)
          .optional(),
      }),
    )
    .length(1),
});

export async function downloadBuild(value: string, cache: string): Promise<PreparedBuild> {
  const link = parseInstallLink(value);
  let url = link.url;
  let name: string | undefined;
  let sha256: string | undefined;
  if (link.manifest) {
    const response = await request(url);
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of response) {
      size += chunk.length;
      if (size > 65_536) {
        response.destroy();
        throw new Error('Manifest exceeds 64 KiB.');
      }
      chunks.push(Buffer.from(chunk));
    }
    const manifest = manifestSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    name = manifest.name;
    ({ url, sha256 } = manifest.files[0]);
  }
  const filename = safeRelative(
    decodeURIComponent(path.posix.basename(validateDownloadUrl(url).pathname)),
  );
  if (!/\.(apk|zip|exe)$/i.test(filename))
    throw new Error('The download URL must end in .apk, .zip or .exe.');
  await mkdir(cache, { recursive: true });
  const temporary = await mkdtemp(path.join(cache, 'download-'));
  try {
    const response = await request(url);
    const hash = createHash('sha256');
    let bytes = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        bytes += chunk.length;
        hash.update(chunk);
        done(
          bytes > 8 * 1024 ** 3
            ? new Error('Download exceeds 8 GiB. Use a local file for larger builds.')
            : null,
          chunk,
        );
      },
    });
    const filenameOnDisk = path.join(temporary, filename);
    await pipeline(
      response,
      meter,
      createWriteStream(filenameOnDisk, { flags: 'wx', mode: 0o600 }),
    );
    if (sha256 && hash.digest('hex') !== sha256.toLowerCase())
      throw new Error('SHA-256 mismatch. The downloaded file was discarded.');
    const build = await prepareBuild(filenameOnDisk, temporary);
    build.temporary = temporary;
    build.info.source = url;
    if (name) build.info.name = name;
    build.info.warnings.push(
      sha256
        ? 'SHA-256 matches the manifest.'
        : 'This download has no SHA-256 checksum. Only install software from a source you trust.',
    );
    return build;
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}
