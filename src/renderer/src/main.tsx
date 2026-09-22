import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import type { OpenDropApi } from '../../shared/types';

declare global {
  interface Window {
    opendrop: OpenDropApi;
  }
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
