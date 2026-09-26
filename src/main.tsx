import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { I18nProvider } from './i18n';
import { AuthProvider } from './lib/auth';
import { PwaProvider, registerServiceWorker } from './lib/pwa';
import './index.css';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <PwaProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </PwaProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
);
