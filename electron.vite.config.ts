import { builtinModules } from 'node:module';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { dependencies } from './package.json';

const runtimeModules = ['electron', ...builtinModules, ...Object.keys(dependencies)];
const external = (id: string) =>
  id.startsWith('node:') || runtimeModules.some((name) => id === name || id.startsWith(`${name}/`));

export default defineConfig({
  main: {
    build: {
      outDir: 'dist/main',
      rolldownOptions: { external, output: { format: 'cjs', entryFileNames: 'index.cjs' } },
    },
  },
  preload: {
    build: {
      outDir: 'dist/preload',
      rolldownOptions: { external, output: { format: 'cjs', entryFileNames: 'index.cjs' } },
    },
  },
  renderer: {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'react-refresh-development-csp',
        apply: 'serve',
        transformIndexHtml: (html) =>
          html.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';"),
      },
    ],
    build: { outDir: 'dist/renderer' },
  },
});
