import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { withI18n } from '../../../testUtils';
import RegisterPage from '../RegisterPage';

jest.mock('axios');

const CONFIG = {
  data: {
    registration_enabled: true,
    min_password_length: 10,
    form_token: 'signed-form-token',
    honeypot_field: 'website',
  },
};

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
    form_token: 'signed-form-token',
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

test('carries the form token the server issued, and no honeypot value', async () => {
  axios.post.mockResolvedValue({ data: { message: 'Check your inbox' } });
  renderPage();
  await waitFor(() => expect(axios.get).toHaveBeenCalled());

  await fillIn({ email: 'someone@example.com', password: 'a-decent-passphrase' });
  await userEvent.click(screen.getByRole('button', { name: /Create account/i }));

  await waitFor(() => expect(axios.post).toHaveBeenCalled());
  const body = axios.post.mock.calls[0][1];
  expect(body.form_token).toBe('signed-form-token');
  // A person never fills the honeypot, so it must not be sent at all.
  expect(body.website).toBeUndefined();
});

test('the honeypot is hidden from assistive technology and the tab order', async () => {
  renderPage();
  await waitFor(() => expect(axios.get).toHaveBeenCalled());

  // Absent from the accessibility tree, so a screen-reader user never meets it. Queried by
  // role rather than by label: role queries are the ones that honour aria-hidden, which is
  // exactly the property being asserted.
  expect(screen.queryByRole('textbox', { name: /Leave this field empty/i })).not.toBeInTheDocument();

  const honeypot = document.querySelector('input[name="website"]');
  expect(honeypot).toBeInTheDocument();
  expect(honeypot).toHaveAttribute('tabindex', '-1');
  expect(honeypot).toHaveAttribute('autocomplete', 'off');
  expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
});

test('a bot filling the honeypot sends it, so the server can drop the submission', async () => {
  axios.post.mockResolvedValue({ data: { message: 'Check your inbox' } });
  renderPage();
  await waitFor(() => expect(axios.get).toHaveBeenCalled());

  await fillIn({ email: 'bot@example.com', password: 'a-decent-passphrase' });
  await userEvent.type(document.querySelector('input[name="website"]'), 'http://spam.example');
  await userEvent.click(screen.getByRole('button', { name: /Create account/i }));

  await waitFor(() => expect(axios.post).toHaveBeenCalled());
  expect(axios.post.mock.calls[0][1].website).toBe('http://spam.example');
});
