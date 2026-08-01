import { Button, Stack, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import logger from "@shared/utils/logger";
import AuthPageLayout, { AuthLink } from "./AuthPageLayout";
import HoneypotField from "./HoneypotField";
import { errorMessage, fetchRegistrationConfig, requestPasswordReset } from "./api";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Same bot resistance as sign-up: this endpoint also emails an address someone typed,
  // which makes it just as usable for burying a stranger's inbox.
  const [guard, setGuard] = useState({ formToken: "", honeypotField: "website", honeypot: "" });

  useEffect(() => {
    let cancelled = false;
    fetchRegistrationConfig()
      .then((config) => {
        if (cancelled) return;
        setGuard((current) => ({
          ...current,
          formToken: config.form_token || "",
          honeypotField: config.honeypot_field || current.honeypotField,
        }));
      })
      .catch((err) => logger.warn("Failed to load the form token:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // The reply is the same whether or not the address exists, by design - so this
      // shows it verbatim rather than claiming a link was definitely sent.
      const data = await requestPasswordReset(email.trim(), {
        formToken: guard.formToken,
        honeypot: guard.honeypot,
      });
      setSuccess(data.message);
    } catch (err) {
      setError(errorMessage(err, t("auth.reset_request_failed", "Could not start the password reset")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageLayout
      title={t("auth.forgot_title", "Reset your password")}
      subtitle={success ? "" : t("auth.forgot_subtitle", "We'll email you a link to choose a new password.")}
      error={error}
      success={success}
      footer={<AuthLink to="/admin">{t("auth.back_to_login", "Back to sign in")}</AuthLink>}
    >
      {!success && (
        <Stack component="form" spacing={3} onSubmit={handleSubmit} noValidate>
          <TextField
            label={t("auth.email", "Email")}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            fullWidth
          />
          <HoneypotField
            name={guard.honeypotField}
            value={guard.honeypot}
            onChange={(value) => setGuard({ ...guard, honeypot: value })}
          />
          <Button type="submit" variant="contained" size="large" disabled={submitting}>
            {t("auth.send_reset_link", "Send the reset link")}
          </Button>
        </Stack>
      )}
    </AuthPageLayout>
  );
}
