import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AndroidUpdatePrompt } from './components/AndroidUpdatePrompt';
import { initializeNativeApp } from './nativeApp';
import './styles.css';

initializeNativeApp();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <AndroidUpdatePrompt />
  </StrictMode>,
);
