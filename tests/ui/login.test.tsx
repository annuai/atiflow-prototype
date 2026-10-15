// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from '../../src/features/auth/LoginPage';
import { authStore } from '../../src/features/auth/authStore';
import type { PublicUser } from '../../src/features/auth/types';
import { setServices } from '../../src/services';
import { createDummyServices } from '../../src/services/dummy';
import { installDomShims } from '../helpers/dom';
import { memoryStorage } from '../helpers/memoryStorage';

installDomShims();
afterEach(cleanup);
beforeEach(() => {
  setServices(createDummyServices({ backend: memoryStorage().backend, sessionBackend: memoryStorage().backend }));
  authStore.setState({ user: null });
});

describe('sign in screen', () => {
  it('asks for both fields, refuses a wrong password with a message, and signs a right one in through the auth service', async () => {
    const user = userEvent.setup();
    let signedIn: PublicUser | null = null;
    render(<LoginPage onAuthenticated={(u) => (signedIn = u)} />);
    // (the card is drawn again after a refusal, so the fields are looked up each time)
    const name = () => screen.getByPlaceholderText(/e\.g\./i);
    const pass = () => document.querySelector('input[type=password]') as HTMLInputElement;
    const submit = () => user.click(screen.getByRole('button', { name: /Log in/i }));
    await submit();
    expect(await screen.findByText(/Enter your username and password/)).toBeTruthy();
    await user.type(name(), 'arjun');
    await user.type(pass(), 'wrong');
    await submit();
    expect(await screen.findByText(/Incorrect username or password/)).toBeTruthy();
    expect(signedIn).toBeNull();
    await user.clear(pass());
    await user.type(pass(), '1234');
    await submit();
    await waitFor(() => expect(signedIn).not.toBeNull());
    expect((signedIn as unknown as PublicUser).username).toBe('arjun');
    expect(authStore.getState().user?.role).toBe('supervisor');
  });
});
