import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterApp } from './routing/RouterApp';
import './styles.css';

const rootElement = document.getElementById('root');
if (rootElement)
  createRoot(rootElement).render(
    <StrictMode>
      <RouterApp />
    </StrictMode>,
  );
