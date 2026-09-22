import { describe, expect, it } from 'vitest';
import { parseInstallLink, publicAddress, validateDownloadUrl } from '../src/main/downloads';

describe('Install links', () => {
  it('reads compatible manifest URLs without installing anything', () => {
    expect(
      parseInstallLink('opendrop://install?manifest=https%3A%2F%2Fexample.com%2Fgame.json'),
    ).toEqual({ url: 'https://example.com/game.json', manifest: true });
  });
  it('accepts direct HTTPS files', () => {
    expect(parseInstallLink('https://example.com/game.apk').manifest).toBe(false);
  });
  it.each([
    'http://example.com/game.apk',
    'file:///etc/passwd',
    'https://localhost/game.apk',
    'https://user:pass@example.com/game.apk',
    'https://127.0.0.1/game.apk',
    'https://10.2.3.4/game.apk',
    'https://[::1]/game.apk',
    'https://[::ffff:127.0.0.1]/game.apk',
    'https://example.com:22/game.apk',
  ])('rejects %s', (url) => {
    expect(() => validateDownloadUrl(url)).toThrow();
  });
  it('rejects ambiguous install links', () => {
    expect(() =>
      parseInstallLink(
        'opendrop://install?url=https://example.com/g.apk&manifest=https://example.com/m.json',
      ),
    ).toThrow();
  });
  it.each([
    '0.0.0.0',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.2',
    '100.64.0.1',
    '224.1.1.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    '2002:7f00:1::',
  ])('blocks non-public address %s', (ip) => {
    expect(publicAddress(ip)).toBe(false);
  });
  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('permits public address %s', (ip) => {
    expect(publicAddress(ip)).toBe(true);
  });
});
