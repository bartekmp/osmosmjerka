import { Button, Stack, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import logger from "@shared/utils/logger";
import AuthPageLayout, { AuthLink } from "./AuthPageLayout";
import { errorMessage, fetchRegistrationConfig, resetPassword } from "./api";

const DEFAULT_MIN_PASSWORD_LENGTH = 10;

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [minLength, setMinLength] = useState(DEFAULT_MIN_PASSWORD_LENGTH);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchRegistrationConfig()
      .then((config) => {
        if (!cancelled && config.min_password_length) setMinLength(config.min_password_length);
      })
      .catch((err) => logger.warn("Failed to load password policy:", err));
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
      const data = await resetPassword({ token, password: form.password });
      setSuccess(data.message);
    } catch (err) {
      setError(errorMessage(err, t("auth.reset_failed", "Could not change the password")));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthPageLayout
        title={t("auth.reset_title", "Choose a new password")}
        error={t("auth.reset_no_token", "This link is missing its token. Request a new one.")}
        footer={<AuthLink to="/forgot-password">{t("auth.request_new_link", "Request a new link")}</AuthLink>}
      />
    );
  }

  if (success) {
    return (
      <AuthPageLayout
        title={t("auth.reset_title", "Choose a new password")}
        success={success}
        footer={<AuthLink to="/admin">{t("auth.go_to_login", "Sign in")}</AuthLink>}
      />
    );
  }

  return (
    <AuthPageLayout
      title={t("auth.reset_title", "Choose a new password")}
      error={error}
      footer={<AuthLink to="/forgot-password">{t("auth.request_new_link", "Request a new link")}</AuthLink>}
    >
      <Stack component="form" spacing={3} onSubmit={handleSubmit} noValidate>
        <TextField
          label={t("new_password", "New Password")}
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
        <Button type="submit" variant="contained" size="large" disabled={submitting}>
          {t("auth.set_new_password", "Set the new password")}
        </Button>
      </Stack>
    </AuthPageLayout>
  );
}
