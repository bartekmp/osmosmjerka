import axios from "axios";

/**
 * Calls to the public self-service account endpoints.
 *
 * Deliberately the bare axios client rather than the shared apiClient: these run while
 * nobody is signed in, and attaching a stale token to a registration or reset request
 * would be pointless at best and confusing at worst.
 */
const API_BASE = "/api/auth";

/**
 * The bot-resistance fields the public forms send back.
 *
 * `form_token` is the signed timestamp /config handed out when the page loaded — it proves
 * the form was actually rendered and lets the server reject a submission that arrived
 * impossibly fast. `honeypot` carries whatever ended up in the hidden field, which for a
 * real person is always nothing.
 */
function botFields({ formToken, honeypot }) {
  return {
    ...(formToken ? { form_token: formToken } : {}),
    ...(honeypot ? { website: honeypot } : {}),
  };
}

/** Pull a human-readable message out of an axios error, whatever shape the body has. */
export function errorMessage(error, fallback) {
  const body = error?.response?.data;
  return body?.error || body?.detail || error?.message || fallback;
}

export async function fetchRegistrationConfig() {
  const { data } = await axios.get(`${API_BASE}/config`);
  return data;
}

export async function register({ email, password, username, formToken, honeypot }) {
  const { data } = await axios.post(`${API_BASE}/register`, {
    email,
    password,
    // Omit rather than send "": the backend treats an absent name as "derive one for me".
    ...(username ? { username } : {}),
    ...botFields({ formToken, honeypot }),
  });
  return data;
}

export async function resendVerification(email) {
  const { data } = await axios.post(`${API_BASE}/resend-verification`, { email });
  return data;
}

export async function verifyEmail(token) {
  const { data } = await axios.post(`${API_BASE}/verify-email`, { token });
  return data;
}

export async function requestPasswordReset(email, { formToken, honeypot } = {}) {
  const { data } = await axios.post(`${API_BASE}/forgot-password`, {
    email,
    ...botFields({ formToken, honeypot }),
  });
  return data;
}

export async function resetPassword({ token, password }) {
  const { data } = await axios.post(`${API_BASE}/reset-password`, { token, password });
  return data;
}
