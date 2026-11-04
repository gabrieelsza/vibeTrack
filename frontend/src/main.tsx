import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Registra o Service Worker para suporte PWA instalável e App Shell Offline (RF-010)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Ignora erro de registro em ambientes restritos
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
