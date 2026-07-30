import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { withI18n } from '../../../testUtils';
import RegisterPage from '../RegisterPage';

jest.mock('axios');

const CONFIG = { data: { registration_enabled: true, min_password_length: 10 } };

function renderPage() {
  return render(withI18n(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  ));
}

async function fillIn({ email, password, confirm }) {
  await userEvent.type(screen.getByLabelText(/^Email/), email);
  await userEvent.type(screen.getByLabelText(/^Password/), password);
  await userEvent.type(screen.getByLabelText(/Confirm password/), confirm ?? password);
}

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue(CONFIG);
});

test('submits the address, the password and no username when none is given', async () => {
  axios.post.mockResolvedValue({ data: { message: 'Check your inbox' } });
  renderPage();
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith('/api/auth/config'));

  await fillIn({ email: 'someone@example.com', password: 'a-decent-passphrase' });
  await userEvent.click(screen.getByRole('button', { name: /Create account/i }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/api/auth/register', {
    email: 'someone@example.com',
    password: 'a-decent-passphrase',
  }));
});

test('includes the display name when one is typed', async () => {
  axios.post.mockResolvedValue({ data: { message: 'Check your inbox' } });
  renderPage();

  await userEvent.type(screen.getByLabelText(/Display name/), 'Someone');
  await fillIn({ email: 'someone@example.com', password: 'a-decent-passphrase' });
  await userEvent.click(screen.getByRole('button', { name: /Create account/i }));

  await waitFor(() => expect(axios.post.mock.calls[0][1].username).toBe('Someone'));
});

test('shows the server message and hides the form once the mail is out', async () => {
  axios.post.mockResolvedValue({ data: { message: 'Check your inbox - a link is on its way.' } });
  renderPage();

  await fillIn({ email: 'someone@example.com', password: 'a-decent-passphrase' });
  await userEvent.click(screen.getByRole('button', { name: /Create account/i }));

  await screen.findByText(/a link is on its way/);
  expect(screen.queryByLabelText(/Confirm password/)).not.toBeInTheDocument();
});

test('refuses mismatched passwords without calling the API', async () => {
  renderPage();

  await fillIn({ email: 'someone@example.com', password: 'a-decent-passphrase', confirm: 'something-else' });
  await userEvent.click(screen.getByRole('button', { name: /Create account/i }));

  await screen.findByText(/don't match/i);
  expect(axios.post).not.toHaveBeenCalled();
});

test('refuses a password shorter than the policy without calling the API', async () => {
  renderPage();
  await waitFor(() => expect(axios.get).toHaveBeenCalled());

  await fillIn({ email: 'someone@example.com', password: 'short' });
  await userEvent.click(screen.getByRole('button', { name: /Create account/i }));

  // The helper text under the field carries the same wording, so match the alert itself.
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(/at least 10 characters/i);
  expect(axios.post).not.toHaveBeenCalled();
});

test('surfaces the server error when registration is rejected', async () => {
  axios.post.mockRejectedValue({ response: { data: { error: 'That display name is already taken.' } } });
  renderPage();

  await fillIn({ email: 'someone@example.com', password: 'a-decent-passphrase' });
  await userEvent.click(screen.getByRole('button', { name: /Create account/i }));

  await screen.findByText('That display name is already taken.');
});

test('hides the form entirely when the instance has registration disabled', async () => {
  axios.get.mockResolvedValue({ data: { registration_enabled: false, min_password_length: 10 } });
  renderPage();

  await screen.findByText(/disabled on this instance/i);
  expect(screen.queryByLabelText(/^Email/)).not.toBeInTheDocument();
});

test('can resend the confirmation mail from the success state', async () => {
  axios.post.mockResolvedValue({ data: { message: 'Check your inbox' } });
  renderPage();

  await fillIn({ email: 'someone@example.com', password: 'a-decent-passphrase' });
  await userEvent.click(screen.getByRole('button', { name: /Create account/i }));
  await screen.findByText('Check your inbox');

  await userEvent.click(screen.getByRole('button', { name: /Resend the confirmation email/i }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    '/api/auth/resend-verification', { email: 'someone@example.com' }
  ));
  expect(await screen.findByRole('button', { name: /sent again/i })).toBeDisabled();
});
