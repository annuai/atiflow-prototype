import { Component, type ReactNode } from 'react';
import { AlertCircle } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { reportError } from '@/platform';

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
      <div className="content grid place-items-center">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-error-secondary text-fg-error-primary">
            <AlertCircle className="size-6" />
          </span>
          <h1 className="text-lg font-semibold text-primary">This page could not be shown</h1>
          <p className="text-sm text-tertiary">
            Something went wrong while drawing it. Try again; if it keeps happening, tell a configurator.
          </p>
          <Button size="md" color="secondary" onPress={() => this.setState({ failed: false })}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
}
