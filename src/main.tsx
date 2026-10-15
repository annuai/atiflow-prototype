import { createRoot } from 'react-dom/client';
import './styles/globals.css'; // Tailwind + Untitled UI theme first, so the dashboard's own CSS wins conflicts
import './ui/tokens.css';
import './ui/app.css';
import { installGlobalErrorHandlers, loadConfig, log } from './platform';
import { createServices, setServices } from './services';

/** Start-up: read the runtime configuration, report uncaught errors, choose the services (dummy or API) from it, then load and draw the app. */
async function start() {
  const config = await loadConfig({
    env: import.meta.env,
    fetchJson: async () => {
      const r = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    onProblem: (m) => log.warn(m),
  });
  installGlobalErrorHandlers(window);
  setServices(createServices(config)); // before any app module loads: stores read their data from the services when they start
  const { AppRoot } = await import('./app/AppRoot');
  createRoot(document.getElementById('root')!).render(<AppRoot />);
}
void start();
