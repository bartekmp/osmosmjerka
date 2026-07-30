import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { withI18n } from '../../../testUtils';
import ForgotPasswordPage from '../ForgotPasswordPage';
import ResetPasswordPage from '../ResetPasswordPage';

jest.mock('axios');

const CONFIG = { data: { registration_enabled: true, min_password_length: 10 } };

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue(CONFIG);
});

describe('ForgotPasswordPage', () => {
  function renderPage() {
    return render(withI18n(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    ));
  }

  test('asks the server for a reset link', async () => {
    axios.post.mockResolvedValue({ data: { message: 'Check your inbox' } });
    renderPage();

    await userEvent.type(screen.getByLabelText(/^Email/), '  Someone@Example.com  ');
    await userEvent.click(screen.getByRole('button', { name: /Send the reset link/i }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      '/api/auth/forgot-password', { email: 'Someone@Example.com' }
    ));
  });

  test('shows the enumeration-safe reply verbatim and hides the form', async () => {
    const message = 'Check your inbox - if that address has an account, a reset link is on its way.';
    axios.post.mockResolvedValue({ data: { message } });
    renderPage();

    await userEvent.type(screen.getByLabelText(/^Email/), 'nobody@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Send the reset link/i }));

    await screen.findByText(message);
    expect(screen.queryByLabelText(/^Email/)).not.toBeInTheDocument();
  });

  test('surfaces a rate-limit refusal', async () => {
    axios.post.mockRejectedValue({ response: { data: { detail: 'Too many requests.' } } });
    renderPage();

    await userEvent.type(screen.getByLabelText(/^Email/), 'someone@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Send the reset link/i }));

    await screen.findByText('Too many requests.');
  });
});

describe('ResetPasswordPage', () => {
  function renderPage(search) {
    return render(withI18n(
      <MemoryRouter initialEntries={[`/reset-password${search}`]}>
        <ResetPasswordPage />
      </MemoryRouter>
    ));
  }

  async function fillIn(password, confirm) {
    await userEvent.type(screen.getByLabelText(/New Password/i), password);
    await userEvent.type(screen.getByLabelText(/Confirm password/i), confirm ?? password);
  }

  test('sends the token from the query string with the new password', async () => {
    axios.post.mockResolvedValue({ data: { message: 'Your password has been changed.' } });
    renderPage('?token=tok123');

    await fillIn('a-brand-new-passphrase');
    await userEvent.click(screen.getByRole('button', { name: /Set the new password/i }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      '/api/auth/reset-password', { token: 'tok123', password: 'a-brand-new-passphrase' }
    ));
    await screen.findByText('Your password has been changed.');
  });

  test('refuses mismatched passwords without spending the token', async () => {
    renderPage('?token=tok123');

    await fillIn('a-brand-new-passphrase', 'something-else');
    await userEvent.click(screen.getByRole('button', { name: /Set the new password/i }));

    await screen.findByText(/don't match/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('refuses a too-short password without spending the token', async () => {
    renderPage('?token=tok123');
    await waitFor(() => expect(axios.get).toHaveBeenCalled());

    await fillIn('short');
    await userEvent.click(screen.getByRole('button', { name: /Set the new password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/at least 10 characters/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('surfaces the server error for a spent link', async () => {
    axios.post.mockRejectedValue({ response: { data: { error: 'This reset link is invalid or has expired.' } } });
    renderPage('?token=stale');

    await fillIn('a-brand-new-passphrase');
    await userEvent.click(screen.getByRole('button', { name: /Set the new password/i }));

    await screen.findByText('This reset link is invalid or has expired.');
  });

  test('shows no form at all when the link has no token', async () => {
    renderPage('');

    await screen.findByText(/missing its token/i);
    expect(screen.queryByLabelText(/New Password/i)).not.toBeInTheDocument();
  });
});
