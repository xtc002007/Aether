import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log('[Aether] main.tsx executing, mounting React...');
const rootEl = document.getElementById('root');
if (!rootEl) {
  console.error('[Aether] FATAL: #root element not found!');
} else {
  console.log('[Aether] #root found, rendering App...');
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
