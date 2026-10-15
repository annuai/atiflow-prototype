import { createRoot } from 'react-dom/client';
import './styles/globals.css'; // Tailwind + Untitled UI theme first, so the dashboard's own CSS wins conflicts
import './ui/tokens.css';
import './ui/app.css';
import { AppRoot } from './app/AppRoot';
import { installGlobalErrorHandlers, loadConfig, log } from './platform';

/** Start-up: read the runtime configuration, report uncaught errors, then draw the app. */
async function start() {
  await loadConfig({
    env: import.meta.env,
    fetchJson: async () => { const r = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); },
    onProblem: (m) => log.warn(m),
  });
  installGlobalErrorHandlers(window);
  createRoot(document.getElementById('root')!).render(<AppRoot />);
}
void start();
