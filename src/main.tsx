import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AndroidUpdatePrompt } from './components/AndroidUpdatePrompt';
import { PublicLegalPage } from './components/PublicLegalPage';
import { initializeNativeApp } from './nativeApp';
import './styles.css';

initializeNativeApp();

const publicPage = window.location.pathname === '/privacy' ? 'privacy' : window.location.pathname === '/delete-account' ? 'delete-account' : null;
const isAccordion3DLab = window.location.pathname === '/dev/accordion-3d';
const Accordion3DLab = lazy(() => import('./components/accordion3d/Accordion3DLab'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {publicPage
      ? <PublicLegalPage kind={publicPage} />
      : isAccordion3DLab
        ? <Suspense fallback={<div className="app-loading"><strong>Chargement du modèle 3D…</strong></div>}><Accordion3DLab /></Suspense>
        : <><App /><AndroidUpdatePrompt /></>}
  </StrictMode>,
);
