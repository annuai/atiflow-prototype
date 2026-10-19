import { Component, type ReactNode } from 'react';
import { AlertCircle } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { reportError } from '@/platform';
import { copy } from './copy';
import { Page } from '@/components/page';
import { openSupport } from '@/features/support';

/** A page that fails to draw must not leave a blank screen: say so, and offer to try again. (Keyed by the page, so moving to another page starts fresh.) */
export class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    reportError(error, { where: 'page' });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Page className="grid place-items-center">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-error-secondary text-fg-error-primary">
            <AlertCircle className="size-6" />
          </span>
          <h1 className="text-lg font-semibold text-primary">{copy.pageErrorTitle}</h1>
          <p className="text-sm text-tertiary">{copy.pageErrorText}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="md" color="secondary" onPress={() => this.setState({ failed: false })}>
              {copy.tryAgain}
            </Button>
            <Button size="md" color="primary" onPress={() => openSupport({ view: 'new' })}>
              {copy.startTicket}
            </Button>
          </div>
        </div>
      </Page>
    );
  }
}
