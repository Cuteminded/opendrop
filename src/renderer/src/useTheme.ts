import { useLayoutEffect, useState } from 'react';

export type Appearance = 'dark' | 'light' | 'system';
const isAppearance = (value: string | null): value is Appearance =>
  value === 'dark' || value === 'light' || value === 'system';

export function useTheme() {
  const [appearance, setAppearance] = useState<Appearance>(() => {
    const saved = localStorage.getItem('opendrop.appearance');
    return isAppearance(saved) ? saved : 'dark';
  });

  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      root.classList.add('theme-changing');
      root.dataset.theme =
        appearance === 'system' ? (media.matches ? 'dark' : 'light') : appearance;
      void root.offsetHeight;
      frame = requestAnimationFrame(() => root.classList.remove('theme-changing'));
    };
    update();
    localStorage.setItem('opendrop.appearance', appearance);
    media.addEventListener('change', update);
    return () => {
      media.removeEventListener('change', update);
      cancelAnimationFrame(frame);
      root.classList.remove('theme-changing');
    };
  }, [appearance]);

  return { appearance, setAppearance };
}
