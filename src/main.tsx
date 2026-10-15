import { createRoot } from 'react-dom/client';
import './styles/globals.css'; // Tailwind + Untitled UI theme first, so the dashboard's own CSS wins conflicts
import './ui/tokens.css';
import './ui/app.css';
import { BootFailure } from './shell/BootFailure';
import { installGlobalErrorHandlers, loadConfig, log, observeWebVitals } from './platform';
import { chooseLocale, setLocale } from './i18n';
import { createServices, hydrateServices, setServices } from './services';

/**
 * Start-up, in this order: read the runtime configuration, report uncaught errors, choose the services (dummy or API) from the configuration, LOAD THEIR DATA, and only then load and
 * draw the app (its stores start from what the services already hold). If the data cannot be loaded a retry screen is drawn instead of the app.
 */
const root = createRoot(document.getElementById('root')!);
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
  observeWebVitals();
  const services = setServices(createServices(config));
  const { failed } = await hydrateServices(services);
  // the language before anything is drawn: this device's choice, else the site default, else the browser's
  setLocale(chooseLocale({ device: services.device.get('locale'), site: services.settings.read().general.language }));
  if (failed.length) {
    root.render(<BootFailure failed={failed} onRetry={() => void start()} />);
    return;
  }
  const { AppRoot } = await import('./app/AppRoot');
  root.render(<AppRoot />);
}
void start();
