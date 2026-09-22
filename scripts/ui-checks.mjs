import { expect } from '@playwright/test';

export async function expectContentToFit(page) {
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const elements = [...document.querySelectorAll('button, input, select, summary, h1, h2, p')];
    return elements
      .filter((element) => {
        if (!element.checkVisibility()) return false;
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > width + 1;
      })
      .map((element) => element.outerHTML.slice(0, 160));
  });
  expect(overflow, 'Content must fit without horizontal scrolling').toEqual([]);
}

export async function textContrast(page, selectors) {
  return page.evaluate((selectors) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = (color) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].map((v, i) => (i === 3 ? v / 255 : v));
    };
    const blend = (a, b) => a.slice(0, 3).map((v, i) => v * a[3] + b[i] * (1 - a[3]));
    const luminance = (color) =>
      color
        .map((value) => {
          value /= 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
    return selectors.map((selector) => {
      const element = document.querySelector(selector);
      const parents = [];
      for (let parent = element; parent; parent = parent.parentElement) parents.unshift(parent);
      const background = parents.reduce(
        (color, parent) => blend(rgba(getComputedStyle(parent).backgroundColor), color),
        [255, 255, 255],
      );
      const foreground = blend(rgba(getComputedStyle(element).color), background);
      const [a, b] = [luminance(foreground), luminance(background)];
      return { selector, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
  }, selectors);
}

export async function resize(app, width, height = 820, zoom = 1) {
  await app.evaluate(
    ({ BrowserWindow }, { width, height, zoom }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.webContents.setZoomFactor(zoom);
      window.setMinimumSize(320, 300);
      window.setContentSize(width, height);
    },
    { width, height, zoom },
  );
  const page = await app.firstWindow();
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(Math.round(width / zoom));
}

export async function showState(app, state) {
  await app.evaluate(({ BrowserWindow }, state) => {
    BrowserWindow.getAllWindows()[0].webContents.send('opendrop:state', state);
  }, state);
}

export async function screenshot(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/interface/${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}
