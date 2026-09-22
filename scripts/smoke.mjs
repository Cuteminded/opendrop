import { _electron as electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const data = await mkdtemp(path.join(tmpdir(), 'opendrop-ui-'));
let app;
try {
  app = await electron.launch({
    args: [path.resolve('dist/main/index.cjs'), '--demo', `--data-dir=${data}`],
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.getByRole('switch', { name: 'Test mode' })).toBeChecked();
  await page.getByRole('button', { name: 'Connect simulator' }).click();
  await expect(page.getByText('Simulated connection', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try a sample build' }).click();
  await expect(page.getByRole('button', { name: 'Simulate installation' })).toBeDisabled();
  await page.getByLabel('Start file').selectOption('orbit.apk');
  await page.getByLabel('App name').fill('Smoke test orbit');
  await page.getByRole('button', { name: 'Simulate installation' }).click();
  await expect(page.locator('.job-status').first()).toHaveText('Simulated', { timeout: 10000 });
  await page.getByRole('button', { name: 'Library' }).click();
  await expect(page.getByText('Smoke test orbit', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Launch Smoke test orbit' }).click();
  await page.getByLabel('Search library').fill('missing-app');
  await expect(page.getByText('No matching apps')).toBeVisible();
  await page.getByLabel('Search library').fill('');
  await page.getByRole('button', { name: 'Activity' }).click();
  await expect(page.getByText('Simulated launch: Smoke test orbit.')).toBeVisible();
  await page.getByRole('button', { name: 'Install', exact: true }).click();
  await page.getByRole('button', { name: 'Install from a link' }).click();
  await page.getByLabel('Build or manifest URL').fill('http://127.0.0.1/app.apk');
  await page.getByRole('button', { name: 'Download for review' }).click();
  await expect(page.locator('.modal-error')).toContainText('public HTTPS');
  await page.getByRole('button', { name: 'Close link dialog' }).click();
  await expect(page.getByRole('button', { name: 'Dismiss error' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Install from a link' })).toBeFocused();
  await page.getByRole('button', { name: 'Try a sample build' }).click();
  await page.getByLabel('Start file').selectOption('Orbit.exe');
  await page.getByRole('button', { name: 'Simulate installation' }).click();
  await page.getByRole('button', { name: 'Cancel Orbit playground' }).click();
  await expect(page.locator('.job-status').first()).toHaveText('Cancelled');
  await page.getByRole('switch', { name: 'Test mode' }).click();
  await expect(page.getByRole('button', { name: 'Pair headset' })).toBeVisible();
  await expect(page.getByText('No headset connected')).toBeVisible();
  await page.getByRole('switch', { name: 'Test mode' }).click();
  await page.getByRole('button', { name: 'Connect simulator' }).click();
  await mkdir('test-results', { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/opendrop-desktop.png' });
  expect(errors).toEqual([]);
  console.log(
    'Desktop smoke test passed: install, library, launch, search, URL validation, cancel and mode isolation.',
  );
} finally {
  await app?.close();
  await rm(data, { recursive: true, force: true });
}
