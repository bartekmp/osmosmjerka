import { Button, Stack, TextField } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import AuthPageLayout, { AuthLink } from "./AuthPageLayout";
import { errorMessage, requestPasswordReset } from "./api";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // The reply is the same whether or not the address exists, by design - so this
      // shows it verbatim rather than claiming a link was definitely sent.
      const data = await requestPasswordReset(email.trim());
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
          <Button type="submit" variant="contained" size="large" disabled={submitting}>
            {t("auth.send_reset_link", "Send the reset link")}
          </Button>
        </Stack>
      )}
    </AuthPageLayout>
  );
}
