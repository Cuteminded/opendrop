import { _electron as electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expectContentToFit, resize, screenshot, showState, textContrast } from './ui-checks.mjs';

const data = await mkdtemp(path.join(tmpdir(), 'opendrop-interface-'));
const jobs = Array.from({ length: 8 }, (_, i) => ({
  id: `sample-${i}`,
  name: i === 6 ? 'Long build name '.repeat(5) : `Sample build ${i + 1}`,
  runtime: ['android', 'linux', 'windows'][i % 3],
  entrypoint: 'app.apk',
  bytes: 1024,
  transferred: 1024,
  status: i === 7 ? 'failed' : 'installed',
  error: i === 7 ? 'Transfer interrupted. Choose the build again to retry.' : undefined,
  device: 'demo',
  mode: 'demo',
  createdAt: new Date().toISOString(),
  gameId: `sample-${i}`,
}));
let app;
try {
  await writeFile(path.join(data, 'state.json'), JSON.stringify({ hosts: {}, jobs }));
  await mkdir('test-results/interface', { recursive: true });
  app = await electron.launch({
    args: [path.resolve('dist/main/index.cjs'), '--demo', `--data-dir=${data}`],
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.getByRole('switch', { name: 'Test mode' })).toBeChecked();
  await expect(page.locator('.job-row')).toHaveCount(8);
  await expect(page.getByText('Sample build 8', { exact: true })).toBeVisible();
  const initial = await page.evaluate(() => window.opendrop.state());

  for (const theme of ['dark', 'light']) {
    await page.getByLabel('Appearance').selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const colors = await textContrast(page, [
      '.subtle-count',
      '.count',
      '.version',
      '.job-error',
      '.menu-active',
      '.menu-active span',
    ]);
    for (const pair of colors)
      expect(pair.ratio, `${theme}: ${pair.selector}`).toBeGreaterThanOrEqual(4.5);
    console.log(
      theme,
      'text contrast:',
      colors.map(({ selector, ratio }) => `${selector} ${ratio.toFixed(2)}:1`).join(', '),
    );
    for (const width of [1180, 900, 600, 320]) {
      await resize(app, width);
      for (const name of ['Install', 'Library', 'Community Store', 'Activity']) {
        await page.getByRole('button', { name, exact: true }).click();
        await expectContentToFit(page);
      }
      await page.getByRole('button', { name: 'Install', exact: true }).click();
    }
    await resize(app, 1180, 820, 2);
    await expectContentToFit(page);
    await screenshot(page, `${theme}-zoom-200`);
    await resize(app, 1180);
  }

  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByLabel('Search library').fill('not-installed');
  await expect(page.getByText('No matching apps')).toBeVisible();
  await expect(page.getByText('No installed apps yet')).toHaveCount(0);
  await screenshot(page, 'search-empty');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByLabel('Search library')).toBeFocused();
  await expect(page.locator('.job-row')).toHaveCount(7);
  await page.getByLabel('Filter library').selectOption('linux');
  await expect(page.locator('.job-row')).toHaveCount(2);

  await page.getByRole('button', { name: 'Install', exact: true }).click();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.getByLabel('Filter library')).toHaveValue('linux');
  await page.getByLabel('Filter library').selectOption('all');
  await page.getByRole('button', { name: 'Install', exact: true }).click();
  const opener = page.getByRole('button', { name: 'Install from a link' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Install from a link' });
  const input = page.getByLabel('Build or manifest URL');
  await expect(input).toBeFocused();
  await input.fill('http://127.0.0.1/app.apk');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press(i < 3 ? 'Tab' : 'Shift+Tab');
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
  expect(await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth)).toBe(
    '2px',
  );
  await page.getByRole('button', { name: 'Download for review' }).click();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByRole('alert')).toContainText('Check the link and try again.');
  await expect(page.locator('.error-banner')).toHaveCount(0);
  await resize(app, 320);
  await expectContentToFit(page);
  await screenshot(page, 'dialog-error-narrow');
  await showState(app, { ...initial, busy: 'Downloading and checking build' });
  await expect(page.getByRole('button', { name: 'Downloading and checking...' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.loading').first()).toHaveCSS('mask-image', 'none');
  await showState(app, initial);
  await expect(input).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(page.locator('.error-banner')).toHaveCount(0);

  await showState(app, {
    ...initial,
    jobs: initial.jobs.map((job, i) =>
      i === 7 ? { ...job, status: 'uploading', error: undefined, transferred: 512 } : job,
    ),
  });
  await expect(page.getByRole('button', { name: 'Cancel Sample build 8' })).toBeVisible();
  await expect(
    page.getByRole('progressbar', { name: 'Sample build 8 transfer progress' }),
  ).toHaveAttribute('value', '50');
  await expectContentToFit(page);
  await screenshot(page, 'queue-active-narrow');
  await showState(app, initial);

  await page.getByRole('button', { name: 'Try a sample build' }).click();
  await expect(
    page.getByText('This build contains multiple apps. Choose which one to install.'),
  ).toBeVisible();
  await page.getByLabel('Start file').selectOption('Orbit.exe');
  await page.getByLabel('App name').fill('A long build name '.repeat(4));
  await page.getByText('Build location', { exact: true }).click();
  await expectContentToFit(page);
  await screenshot(page, 'review-narrow');
  await page.getByRole('button', { name: 'Discard build' }).click();
  await expect(opener).toBeVisible();
  await page.getByRole('switch', { name: 'Test mode' }).click();
  await expect(page.getByRole('button', { name: 'Pair headset' })).toBeVisible();
  await page.getByText('Service port', { exact: true }).click();
  await expectContentToFit(page);
  await screenshot(page, 'device-narrow');
  await page.getByText('Service port', { exact: true }).click();

  for (const theme of ['dark', 'light']) {
    await resize(app, 1180);
    await page.getByLabel('Appearance').selectOption(theme);
    await screenshot(page, `device-${theme}`);
  }
  await showState(app, { ...initial, jobs: [], logs: [] });
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.getByText('No installed apps yet')).toBeVisible();
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(page.getByText('No activity yet')).toBeVisible();
  await page.getByRole('button', { name: 'Install', exact: true }).click();
  await expect(page.getByText('Nothing in the queue yet')).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    'Interface checks passed: themes, contrast, flat backgrounds, all pages, queue items, filters, modal keyboard flow, loading, reduced motion, empty states, narrow layouts and 200% zoom.',
  );
} finally {
  await app?.close();
  await rm(data, { recursive: true, force: true });
}
