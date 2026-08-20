import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DiagnosticsMap, RouterApp } from './main';
import './styles.css';

export { DiagnosticsMap };

const root = document.getElementById('diagnostics-root');
if (root)
  createRoot(root).render(
    <StrictMode>
      <RouterApp />
    </StrictMode>,
  );
