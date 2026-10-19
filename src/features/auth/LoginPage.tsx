import { useState, type FormEvent } from 'react';
import { RobotBeacon } from '@/components/data/RobotBeacon';
import { StatusDot } from '@/components/data/StatusDot';
import { AlertCircle, Lock03, Mail01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Input } from '@/components/base/input/input';
import { authStore } from './authStore';
import type { PublicUser } from './types';
import { notify } from '@/ui/toast';
import { LanguageSelect } from '@/components/data/LanguageSelect';
import { copy } from './copy';
import bg from './assets/login-bg.webp';
import logo from '@/ui/icons/ati-flow-logo.svg'; // the Ati Flow logo (white on dark; same one as the sidebar)
import robot from '@/assets/robots/sherpa-xt-lite.svg';
import ribbonTip from './assets/ribbon-tip.svg';
import './login.css';

/**
 * Standalone login screen. It knows nothing about routes or pages: the host passes `onAuthenticated`
 * (see src/app/AppRoot.tsx) and decides where each role lands.
 */
export function LoginPage({ onAuthenticated }: { onAuthenticated: (user: PublicUser) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!username.trim() || !password) {
      setError(copy.errorEmpty);
      setShake((n) => n + 1);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await authStore.getState().login(username, password, keep);
    setBusy(false);
    if (res === 'ok') onAuthenticated(authStore.getState().user!);
    else {
      setError(copy.errorWrong);
      setShake((n) => n + 1);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#eef3f3]">
      {/* The picture fills the page and is anchored to the bottom-left corner, so the robot and the lanes at the bottom of the illustration stay in view. On narrow screens (cropped to a slice) it starts a little in from the left so the robot is not cut off. */}
      <img
        src={bg}
        alt=""
        className="pointer-events-none absolute inset-0 size-full object-cover object-[20%_bottom] sm:object-left-bottom"
      />
      <div className="absolute inset-0 bg-white/40" />

      <div className="absolute right-4 top-4 z-20 w-40 sm:right-8 sm:top-6">
        <LanguageSelect size="sm" aria-label={copy.languageLabel} />
      </div>
      <main className="relative z-10 flex flex-1 items-center justify-center gap-24 px-5 py-10 lg:px-24">
        <section className="hidden max-w-[360px] flex-1 flex-col items-center gap-3 text-center lg:flex">
          <h1 className="w-[342px] text-display-sm font-semibold text-primary">{copy.heroTitle}</h1>
          <p className="w-[320px] text-sm text-secondary">{copy.heroText}</p>
        </section>

        <section className="w-full max-w-[480px]">
          {/* robot + ribbon driving across the top of the card */}
          <div className="ati-lane mx-5 h-[54px] overflow-hidden" aria-hidden>
            <div className="ati-drive flex w-max items-end">
              <div className="relative mr-[-1px] h-[54px] w-[62px] shrink-0 overflow-hidden">
                <img
                  src={robot}
                  alt=""
                  className="pointer-events-none absolute left-[-54%] top-[-24%] h-[143%] w-[197%] max-w-none"
                />
                <RobotBeacon />
              </div>
              <div className="flex shrink-0 items-center py-2">
                <div className="bg-[#33bab1] px-3 text-xs whitespace-nowrap text-white">{copy.ribbon}</div>
                <img src={ribbonTip} alt="" className="h-[18px] w-[12px] shrink-0" />
              </div>
            </div>
          </div>

          <form
            onSubmit={submit}
            noValidate
            className={
              'overflow-hidden rounded-2xl bg-primary shadow-xl ring-1 ring-secondary ' + (shake ? 'ati-shake' : '')
            }
            key={shake}
          >
            {/* sidebar-theme header */}
            <div className="flex flex-col gap-4 bg-[image:var(--surface-sidebar)] px-8 py-7 text-white sm:px-12">
              <div className="flex items-center gap-1">
                <img src={logo} alt="Ati Flow" className="h-8 w-auto" />
                <span className="ml-1 rounded-md bg-[#5eead4]/12 px-1.5 text-[11px] font-medium text-[#5eead4]">
                  v4.0
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <h2 className="text-display-xs font-semibold sm:text-display-sm">{copy.welcome}</h2>
                <p className="text-sm text-slate-300">{copy.welcomeText}</p>
              </div>
            </div>

            <div className="flex flex-col gap-6 px-8 py-8 sm:px-12">
              <div className="flex flex-col gap-4">
                <Input
                  label={copy.username}
                  size="md"
                  icon={Mail01}
                  placeholder={copy.usernamePlaceholder}
                  value={username}
                  onChange={setUsername}
                  name="username"
                  autoComplete="username"
                  isRequired
                  isInvalid={!!error}
                />
                <div>
                  <Input
                    label={copy.password}
                    size="md"
                    icon={Lock03}
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={setPassword}
                    name="password"
                    autoComplete="current-password"
                    isRequired
                    isInvalid={!!error}
                    inputClassName="pr-10"
                  />
                </div>
                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg bg-error-secondary px-3 py-2 text-sm text-error-primary"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    {error}
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <Checkbox size="sm" label={copy.keepSignedIn} isSelected={keep} onChange={setKeep} />
                  <Button
                    type="button"
                    color="link-color"
                    size="sm"
                    onPress={() => notify.info(copy.recoverTitle, copy.recoverText, 'recover')}
                  >
                    {copy.recover}
                  </Button>
                </div>
              </div>
              <Button type="submit" size="lg" color="primary" className="w-full" isLoading={busy}>
                {copy.logIn}
              </Button>
            </div>
          </form>
        </section>
      </main>

      {/* sidebar-theme footer */}
      <footer className="relative z-10 flex items-center justify-between gap-4 bg-[image:var(--surface-sidebar)] px-6 py-4 text-xs text-slate-300 sm:px-20">
        <span>{copy.footer}</span>
        <span className="flex items-center gap-2">
          <StatusDot tone="success" ring />
          {copy.status}
        </span>
      </footer>
    </div>
  );
}
