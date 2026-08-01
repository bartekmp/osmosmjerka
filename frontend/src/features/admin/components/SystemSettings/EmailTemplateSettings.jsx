import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import PropTypes from "prop-types";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import apiClient from "@shared/utils/apiClient";
import logger from "@shared/utils/logger";
import { API_ENDPOINTS } from "../../../../shared";

const BASE = `${API_ENDPOINTS.ADMIN}/settings/email-templates`;

/**
 * Root-admin editor for the transactional emails.
 *
 * Bodies are Markdown. The preview is rendered by the backend rather than in the browser,
 * using the same code that builds the real message — a client-side renderer would
 * eventually disagree with what recipients actually receive.
 */
export default function EmailTemplateSettings({ onNotify }) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState(null);
  const [meta, setMeta] = useState({ smtp_configured: false, from_address: "" });
  const [active, setActive] = useState(null);
  const [draft, setDraft] = useState({ subject: "", body: "" });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [testAddress, setTestAddress] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get(BASE);
      setTemplates(data.templates);
      setMeta({ smtp_configured: data.smtp_configured, from_address: data.from_address });
      const first = Object.keys(data.templates)[0];
      setActive((current) => current ?? first);
      setDraft((current) =>
        current.subject ? current : { subject: data.templates[first].subject, body: data.templates[first].body }
      );
    } catch (err) {
      logger.error("Failed to load email templates:", err);
      setError(t("admin.settings.emails.loadError", "Could not load the email templates"));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const selectTemplate = (kind) => {
    setActive(kind);
    setDraft({ subject: templates[kind].subject, body: templates[kind].body });
    setPreview(null);
    setError("");
  };

  const serverError = (err, fallback) => err?.response?.data?.detail || err?.message || fallback;

  const handleSave = async () => {
    setBusy(true);
    setError("");
    try {
      await apiClient.put(`${BASE}/${active}`, draft);
      await load();
      onNotify(t("admin.settings.emails.saved", "Email template saved"), "success");
    } catch (err) {
      setError(serverError(err, t("admin.settings.emails.saveError", "Could not save the template")));
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await apiClient.post(`${BASE}/${active}/preview`, draft);
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setError(serverError(err, t("admin.settings.emails.previewError", "Could not render the preview")));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await apiClient.post(`${BASE}/${active}/reset`);
      setDraft({ subject: data.subject, body: data.body });
      setPreview(null);
      await load();
      onNotify(t("admin.settings.emails.reset", "Template restored to the default"), "success");
    } catch (err) {
      setError(serverError(err, t("admin.settings.emails.resetError", "Could not restore the default")));
    } finally {
      setBusy(false);
    }
  };

  const handleTestSend = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await apiClient.post(`${BASE}/${active}/test`, { email: testAddress.trim() });
      onNotify(data.message, "success");
    } catch (err) {
      setError(serverError(err, t("admin.settings.emails.testError", "Could not send the test email")));
    } finally {
      setBusy(false);
    }
  };

  if (!templates || !active) {
    return (
      <Paper elevation={2} sx={{ p: 3, display: "flex", justifyContent: "center" }}>
        {error ? <Alert severity="error">{error}</Alert> : <CircularProgress size={24} />}
      </Paper>
    );
  }

  const current = templates[active];
  const dirty = draft.subject !== current.subject || draft.body !== current.body;

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom color="primary">
        {t("admin.settings.emails.title", "Email templates")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t(
          "admin.settings.emails.description",
          "Written in Markdown and sent as both plain text and HTML. Placeholders in double braces are replaced when the email goes out."
        )}
      </Typography>

      {!meta.smtp_configured && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t(
            "admin.settings.emails.noSmtp",
            "No SMTP server is configured, so emails are written to the application log instead of being sent."
          )}
        </Alert>
      )}
      {meta.from_address && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
          {t("admin.settings.emails.from", "Sent from")}: {meta.from_address}
        </Typography>
      )}

      <Tabs value={active} onChange={(_event, value) => selectTemplate(value)} sx={{ mb: 2 }}>
        {Object.keys(templates).map((kind) => (
          <Tab
            key={kind}
            value={kind}
            label={
              kind === "verification"
                ? t("admin.settings.emails.verification", "Confirmation")
                : t("admin.settings.emails.passwordReset", "Password reset")
            }
          />
        ))}
      </Tabs>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack spacing={2}>
        <TextField
          label={t("admin.settings.emails.subject", "Subject")}
          value={draft.subject}
          onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
          fullWidth
        />
        <TextField
          label={t("admin.settings.emails.body", "Body (Markdown)")}
          value={draft.body}
          onChange={(event) => setDraft({ ...draft, body: event.target.value })}
          multiline
          minRows={10}
          fullWidth
          slotProps={{ htmlInput: { style: { fontFamily: "monospace", fontSize: 13 } } }}
        />

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
            {t("admin.settings.emails.placeholders", "Placeholders")}:
          </Typography>
          {current.placeholders.map((name) => (
            <Chip
              key={name}
              label={`{{${name}}}`}
              size="small"
              sx={{ mr: 0.5, mb: 0.5, fontFamily: "monospace" }}
              onClick={() => setDraft({ ...draft, body: `${draft.body}{{${name}}}` })}
            />
          ))}
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="contained" onClick={handleSave} disabled={busy || !dirty}>
            {t("save", "Save")}
          </Button>
          <Button variant="outlined" onClick={handlePreview} disabled={busy}>
            {t("admin.settings.emails.preview", "Preview")}
          </Button>
          <Button variant="outlined" color="secondary" onClick={handleReset} disabled={busy || current.is_default}>
            {t("admin.settings.emails.restoreDefault", "Restore default")}
          </Button>
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
          <TextField
            label={t("admin.settings.emails.testAddress", "Send a test to")}
            value={testAddress}
            onChange={(event) => setTestAddress(event.target.value)}
            size="small"
            sx={{ flexGrow: 1 }}
          />
          <Button variant="outlined" onClick={handleTestSend} disabled={busy || !testAddress.trim()}>
            {t("admin.settings.emails.sendTest", "Send test")}
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {t(
            "admin.settings.emails.testNote",
            "The test uses the saved template with sample values and a placeholder link — it never creates a usable confirmation link."
          )}
        </Typography>

        {preview && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t("admin.settings.emails.previewSubject", "Subject")}: {preview.subject}
            </Typography>
            {/* Rendered in a sandboxed iframe with srcDoc: the preview is the same HTML a
                mail client would get, so it must not run in the admin panel's origin. */}
            <Box
              component="iframe"
              title={t("admin.settings.emails.preview", "Preview")}
              srcDoc={preview.html}
              sandbox=""
              sx={{ width: "100%", height: 420, border: "1px solid", borderColor: "divider", borderRadius: 1 }}
            />
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

EmailTemplateSettings.propTypes = {
  onNotify: PropTypes.func.isRequired,
};
