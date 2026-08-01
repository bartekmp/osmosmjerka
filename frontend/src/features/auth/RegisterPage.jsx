import { Button, Stack, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import logger from "@shared/utils/logger";
import AuthPageLayout, { AuthLink } from "./AuthPageLayout";
import HoneypotField from "./HoneypotField";
import { errorMessage, fetchRegistrationConfig, register, resendVerification } from "./api";

const DEFAULT_MIN_PASSWORD_LENGTH = 10;

export default function RegisterPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ email: "", username: "", password: "", confirm: "" });
  const [minLength, setMinLength] = useState(DEFAULT_MIN_PASSWORD_LENGTH);
  // Bot resistance: a signed token proving this form was rendered, plus a field only a
  // script would fill. Neither is visible to the person filling the form in.
  const [guard, setGuard] = useState({ formToken: "", honeypotField: "website", honeypot: "" });
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resent, setResent] = useState(false);

  // The policy lives on the server; read it so the hint and the client-side check can't
  // drift from what registration will actually accept.
  useEffect(() => {
    let cancelled = false;
    fetchRegistrationConfig()
      .then((config) => {
        if (cancelled) return;
        if (config.min_password_length) setMinLength(config.min_password_length);
        setRegistrationEnabled(config.registration_enabled !== false);
        setGuard((current) => ({
          ...current,
          formToken: config.form_token || "",
          honeypotField: config.honeypot_field || current.honeypotField,
        }));
      })
      .catch((err) => logger.warn("Failed to load registration config:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError(t("auth.passwords_do_not_match", "The passwords don't match"));
      return;
    }
    if (form.password.length < minLength) {
      setError(t("auth.password_too_short", { count: minLength }));
      return;
    }

    setSubmitting(true);
    try {
      const data = await register({
        email: form.email.trim(),
        password: form.password,
        username: form.username.trim(),
        formToken: guard.formToken,
        honeypot: guard.honeypot,
      });
      setSuccess(data.message);
    } catch (err) {
      setError(errorMessage(err, t("auth.register_failed", "Could not create the account")));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendVerification(form.email.trim());
      setResent(true);
    } catch (err) {
      setError(errorMessage(err, t("auth.resend_failed", "Could not resend the confirmation email")));
    }
  };

  if (!registrationEnabled) {
    return (
      <AuthPageLayout
        title={t("auth.register_title", "Create an account")}
        error={t("auth.registration_disabled", "Self-registration is disabled on this instance.")}
        footer={<AuthLink to="/admin">{t("auth.back_to_login", "Back to sign in")}</AuthLink>}
      />
    );
  }

  // Once the confirmation mail is out there is nothing left to fill in, so the form is
  // replaced by the "check your inbox" state rather than sitting there invitingly.
  if (success) {
    return (
      <AuthPageLayout
        title={t("auth.register_title", "Create an account")}
        success={success}
        footer={
          <>
            <Button onClick={handleResend} disabled={resent} size="small">
              {resent
                ? t("auth.verification_resent", "Confirmation email sent again")
                : t("auth.resend_verification", "Resend the confirmation email")}
            </Button>
            <AuthLink to="/admin">{t("auth.back_to_login", "Back to sign in")}</AuthLink>
          </>
        }
      />
    );
  }

  return (
    <AuthPageLayout
      title={t("auth.register_title", "Create an account")}
      subtitle={t("auth.register_subtitle", "You'll get an email to confirm your address.")}
      error={error}
      footer={<AuthLink to="/admin">{t("auth.have_account", "Already have an account? Sign in")}</AuthLink>}
    >
      <Stack component="form" spacing={3} onSubmit={handleSubmit} noValidate>
        <TextField
          label={t("auth.email", "Email")}
          type="email"
          value={form.email}
          onChange={update("email")}
          autoComplete="email"
          required
          fullWidth
        />
        <TextField
          label={t("auth.display_name_optional", "Display name (optional)")}
          value={form.username}
          onChange={update("username")}
          autoComplete="nickname"
          helperText={t("auth.display_name_help", "Shown in the app. We'll pick one for you if you leave this empty.")}
          fullWidth
        />
        <TextField
          label={t("password", "Password")}
          type="password"
          value={form.password}
          onChange={update("password")}
          autoComplete="new-password"
          helperText={t("auth.password_hint", { count: minLength })}
          required
          fullWidth
        />
        <TextField
          label={t("auth.confirm_password", "Confirm password")}
          type="password"
          value={form.confirm}
          onChange={update("confirm")}
          autoComplete="new-password"
          required
          fullWidth
        />
        <HoneypotField
          name={guard.honeypotField}
          value={guard.honeypot}
          onChange={(value) => setGuard({ ...guard, honeypot: value })}
        />
        <Button type="submit" variant="contained" size="large" disabled={submitting}>
          {t("auth.create_account", "Create account")}
        </Button>
      </Stack>
    </AuthPageLayout>
  );
}
