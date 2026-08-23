import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterApp } from './routing/RouterApp';
import { AppFooter, AppHeader } from './shell/AppChrome';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { HighScoresPage } from './pages/HighScoresPage';
import { MapView, DiagnosticsMap } from './map/MapView';
import './styles.css';

export {
  AppFooter,
  AppHeader,
  DiagnosticsPage,
  HighScoresPage,
  MapView,
  DiagnosticsMap,
  RouterApp,
};

const rootElement = document.getElementById('root');
if (rootElement)
  createRoot(rootElement).render(
    <StrictMode>
      <RouterApp />
    </StrictMode>,
  );
