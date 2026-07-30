import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Alert, Box, Container, Paper, Stack, Typography } from "@mui/material";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import AdminButton from "@shared/components/ui/AdminButton";

/**
 * Shared frame for the four account pages (register, confirm, forgot, reset).
 *
 * They are all "one card, one form, one message", so the frame owns the heading, the
 * back-to-game affordance and the error/success banners, and each page supplies only its
 * own fields.
 */
export default function AuthPageLayout({ title, subtitle, error, success, children, footer }) {
  const { t } = useTranslation();

  return (
    <Container maxWidth="sm" sx={{ pt: 4, pb: 4 }}>
      <Box sx={{ textAlign: "right", mb: 2 }}>
        <AdminButton to="/" icon={<ArrowBackIcon fontSize="small" />} desktopText={t("back_to_game")} />
      </Box>
      <Paper sx={{ p: 4, borderRadius: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            {subtitle}
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        {children}

        {footer && (
          <Stack spacing={1} sx={{ mt: 3, alignItems: "center" }}>
            {footer}
          </Stack>
        )}
      </Paper>
    </Container>
  );
}

AuthPageLayout.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  error: PropTypes.node,
  success: PropTypes.node,
  children: PropTypes.node,
  footer: PropTypes.node,
};

/** Convenience link styled consistently across the account pages. */
export function AuthLink({ to, children }) {
  return (
    <Typography variant="body2" component={RouterLink} to={to} sx={{ color: "primary.main" }}>
      {children}
    </Typography>
  );
}

AuthLink.propTypes = {
  to: PropTypes.string.isRequired,
  children: PropTypes.node,
};
