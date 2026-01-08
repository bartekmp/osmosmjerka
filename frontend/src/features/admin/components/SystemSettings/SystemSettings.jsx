import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  FormGroup,
  Divider,
  Alert,
  Snackbar,
  Grid,
  Paper,
  TextField,
  Button,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { API_ENDPOINTS, STORAGE_KEYS } from "../../../../shared";
import ScoringRulesEditor from "./ScoringRulesEditor";

const SystemSettings = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({
    statisticsEnabled: false,
    scoringEnabled: false,
    progressiveHintsEnabled: false,
  });
  const [listLimits, setListLimits] = useState({
    userLimit: 50,
    adminLimit: 500,
  });
  const [listLimitsLoading, setListLimitsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // Load current settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load all settings
      const [statisticsResponse, scoringResponse, hintsResponse, limitsResponse] =
        await Promise.all([
          axios.get(`${API_ENDPOINTS.ADMIN}/settings/statistics`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_ENDPOINTS.ADMIN}/settings/scoring`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_ENDPOINTS.ADMIN}/settings/progressive-hints`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_ENDPOINTS.ADMIN}/settings/list-limits`, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => ({ data: { user_limit: 50, admin_limit: 500 } })),
        ]);

      setSettings({
        statisticsEnabled: statisticsResponse.data.enabled,
        scoringEnabled: scoringResponse.data.enabled,
        progressiveHintsEnabled: hintsResponse.data.enabled,
      });
      setListLimits({
        userLimit: limitsResponse.data.user_limit || 50,
        adminLimit: limitsResponse.data.admin_limit || 500,
      });
    } catch (error) {
      console.error("Failed to load system settings:", error);
      showNotification(t("admin.settings.loadError"), "error");
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (settingType, enabled) => {
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) return;
    try {
      let endpoint;
      switch (settingType) {
        case "statistics":
          endpoint = `${API_ENDPOINTS.ADMIN}/settings/statistics`;
          break;
        case "scoring":
          endpoint = `${API_ENDPOINTS.ADMIN}/settings/scoring`;
          break;
        case "progressive-hints":
          endpoint = `${API_ENDPOINTS.ADMIN}/settings/progressive-hints`;
          break;
        default:
          throw new Error(`Unknown setting type: ${settingType}`);
      }

      await axios.put(
        endpoint,
        { enabled },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Refresh settings from server to ensure consistency
      await loadSettings();

      showNotification(t("admin.settings.updateSuccess"), "success");
    } catch (error) {
      console.error(`Failed to update ${settingType} setting:`, error);
      showNotification(t("admin.settings.updateError"), "error");

      // Revert the change on error
      loadSettings();
    }
  };

  const showNotification = (message, severity) => {
    setNotification({
      open: true,
      message,
      severity,
    });
  };

  const handleCloseNotification = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  const handleToggle = (settingType) => (event) => {
    const enabled = event.target.checked;
    updateSetting(settingType, enabled);
  };

  const handleUpdateListLimits = async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) return;

    setListLimitsLoading(true);
    try {
      await axios.put(
        `${API_ENDPOINTS.ADMIN}/settings/list-limits`,
        {
          user_limit: listLimits.userLimit,
          admin_limit: listLimits.adminLimit,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      showNotification(t("admin.settings.updateSuccess"), "success");
    } catch (error) {
      console.error("Failed to update list limits:", error);
      showNotification(t("admin.settings.updateError"), "error");
    } finally {
      setListLimitsLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <Typography>{t("common.loading")}</Typography>
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        {t("admin.settings.title")}
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        {t("admin.settings.description")}
      </Typography>

      <Grid container spacing={3}>
        {/* Game Features */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom color="primary">
              {t("admin.settings.gameFeatures")}
            </Typography>

            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.scoringEnabled}
                    onChange={handleToggle("scoring")}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">
                      {t("admin.settings.scoring.title")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("admin.settings.scoring.description")}
                    </Typography>
                  </Box>
                }
              />

              <Divider sx={{ my: 2 }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.progressiveHintsEnabled}
                    onChange={handleToggle("progressive-hints")}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">
                      {t("admin.settings.progressiveHints.title")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("admin.settings.progressiveHints.description")}
                    </Typography>
                  </Box>
                }
              />
            </FormGroup>
          </Paper>
        </Grid>

        {/* Data Collection */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom color="primary">
              {t("admin.settings.dataCollection")}
            </Typography>

            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.statisticsEnabled}
                    onChange={handleToggle("statistics")}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">
                      {t("admin.settings.statistics.title")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("admin.settings.statistics.description")}
                    </Typography>
                  </Box>
                }
              />
            </FormGroup>
          </Paper>
        </Grid>

        {/* Private List Limits */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom color="primary">
              {t("admin.settings.listLimits.title", "Private List Limits")}
            </Typography>

            <Typography variant="body2" color="text.secondary" paragraph>
              {t("admin.settings.listLimits.description", "Configure maximum number of private lists users can create")}
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label={t("admin.settings.listLimits.userLimit", "User Limit")}
                type="number"
                value={listLimits.userLimit}
                onChange={(e) =>
                  setListLimits({ ...listLimits, userLimit: parseInt(e.target.value) || 0 })
                }
                inputProps={{ min: 1 }}
                fullWidth
              />

              <TextField
                label={t("admin.settings.listLimits.adminLimit", "Admin Limit")}
                type="number"
                value={listLimits.adminLimit}
                onChange={(e) =>
                  setListLimits({ ...listLimits, adminLimit: parseInt(e.target.value) || 0 })
                }
                inputProps={{ min: 1 }}
                fullWidth
              />

              <Button
                variant="contained"
                onClick={handleUpdateListLimits}
                disabled={listLimitsLoading}
                sx={{ mt: 1 }}
              >
                {t("admin.settings.listLimits.save", "Save Limits")}
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Scoring Rules Configuration */}
      <Box mt={3}>
        <ScoringRulesEditor scoringEnabled={settings.scoringEnabled} />
      </Box>

      <Box mt={3}>
        <Alert severity="info">{t("admin.settings.notice")}</Alert>
      </Box>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{ width: "100%" }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default SystemSettings;
