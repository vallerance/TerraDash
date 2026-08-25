import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterApp } from './routing/RouterApp';
import './styles.css';

const root = document.getElementById('diagnostics-root');
if (root)
  createRoot(root).render(
    <StrictMode>
      <RouterApp />
    </StrictMode>,
  );
