import { Box, Button, CircularProgress, Stack, TextField } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import AuthPageLayout, { AuthLink } from "./AuthPageLayout";
import { errorMessage, resendVerification, verifyEmail } from "./api";

/**
 * Landing page for the confirmation link. Redeems the token from the query string on
 * mount; on failure it offers to send a fresh link, since an expired token is by far the
 * most likely reason to be here.
 */
export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState(token ? "verifying" : "missing");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);
  // The token is single-use, so React's development double-effect must not redeem it
  // twice - the second call would fail and report a valid link as expired.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    verifyEmail(token)
      .then((data) => {
        setStatus("confirmed");
        setMessage(data.message);
      })
      .catch((err) => {
        setStatus("failed");
        setMessage(errorMessage(err, t("auth.verify_failed", "This confirmation link is not valid.")));
      });
  }, [token, t]);

  const handleResend = async (event) => {
    event.preventDefault();
    try {
      await resendVerification(email.trim());
      setResent(true);
    } catch (err) {
      setMessage(errorMessage(err, t("auth.resend_failed", "Could not resend the confirmation email")));
    }
  };

  if (status === "verifying") {
    return (
      <AuthPageLayout title={t("auth.verify_title", "Confirming your email")}>
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress />
        </Box>
      </AuthPageLayout>
    );
  }

  if (status === "confirmed") {
    return (
      <AuthPageLayout
        title={t("auth.verify_title", "Confirming your email")}
        success={message}
        footer={<AuthLink to="/admin">{t("auth.go_to_login", "Sign in")}</AuthLink>}
      />
    );
  }

  return (
    <AuthPageLayout
      title={t("auth.verify_title", "Confirming your email")}
      error={status === "missing" ? t("auth.verify_no_token", "This link is missing its token.") : message}
      subtitle={t("auth.verify_resend_prompt", "Enter your email address and we'll send a fresh link.")}
      success={resent ? t("auth.verification_resent", "Confirmation email sent again") : ""}
      footer={<AuthLink to="/admin">{t("auth.back_to_login", "Back to sign in")}</AuthLink>}
    >
      <Stack component="form" spacing={3} onSubmit={handleResend} noValidate>
        <TextField
          label={t("auth.email", "Email")}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          fullWidth
        />
        <Button type="submit" variant="contained" disabled={resent}>
          {t("auth.resend_verification", "Resend the confirmation email")}
        </Button>
      </Stack>
    </AuthPageLayout>
  );
}
