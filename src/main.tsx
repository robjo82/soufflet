import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AndroidUpdatePrompt } from './components/AndroidUpdatePrompt';
import { PublicLegalPage } from './components/PublicLegalPage';
import { initializeNativeApp } from './nativeApp';
import './styles.css';

initializeNativeApp();

const publicPage = window.location.pathname === '/privacy' ? 'privacy' : window.location.pathname === '/delete-account' ? 'delete-account' : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {publicPage ? <PublicLegalPage kind={publicPage} /> : <><App /><AndroidUpdatePrompt /></>}
  </StrictMode>,
);
