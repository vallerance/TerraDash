import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterApp } from './main';
import { DiagnosticsMap } from './map/MapView';
import './styles.css';

export { DiagnosticsMap };

const root = document.getElementById('diagnostics-root');
if (root)
  createRoot(root).render(
    <StrictMode>
      <RouterApp />
    </StrictMode>,
  );
