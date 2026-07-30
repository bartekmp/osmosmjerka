import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { withI18n } from '../../../testUtils';
import VerifyEmailPage from '../VerifyEmailPage';

jest.mock('axios');

function renderPage(search) {
  return render(withI18n(
    <MemoryRouter initialEntries={[`/verify-email${search}`]}>
      <VerifyEmailPage />
    </MemoryRouter>
  ));
}

beforeEach(() => jest.clearAllMocks());

test('redeems the token from the query string and reports success', async () => {
  axios.post.mockResolvedValue({ data: { message: 'Your email is confirmed.' } });
  renderPage('?token=abc123');

  await screen.findByText('Your email is confirmed.');
  expect(axios.post).toHaveBeenCalledWith('/api/auth/verify-email', { token: 'abc123' });
  expect(screen.getByRole('link', { name: /Sign in/i })).toBeInTheDocument();
});

test('redeems the single-use token exactly once', async () => {
  axios.post.mockResolvedValue({ data: { message: 'Your email is confirmed.' } });
  renderPage('?token=abc123');

  await screen.findByText('Your email is confirmed.');
  expect(axios.post).toHaveBeenCalledTimes(1);
});

test('offers a fresh link when the token is rejected', async () => {
  axios.post.mockRejectedValue({ response: { data: { error: 'This confirmation link is invalid or has expired.' } } });
  renderPage('?token=stale');

  await screen.findByText('This confirmation link is invalid or has expired.');
  expect(screen.getByLabelText(/^Email/)).toBeInTheDocument();
});

test('resends the confirmation mail from the failure state', async () => {
  axios.post.mockRejectedValueOnce({ response: { data: { error: 'expired' } } });
  renderPage('?token=stale');
  await screen.findByText('expired');

  axios.post.mockResolvedValueOnce({ data: { message: 'sent' } });
  await userEvent.type(screen.getByLabelText(/^Email/), 'someone@example.com');
  await userEvent.click(screen.getByRole('button', { name: /Resend the confirmation email/i }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    '/api/auth/resend-verification', { email: 'someone@example.com' }
  ));
});

test('says so when the link carries no token at all, without calling the API', async () => {
  renderPage('');

  await screen.findByText(/missing its token/i);
  expect(axios.post).not.toHaveBeenCalled();
});
