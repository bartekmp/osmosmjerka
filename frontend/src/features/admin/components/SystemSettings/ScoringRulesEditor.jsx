import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { API_ENDPOINTS, STORAGE_KEYS } from "../../../../shared";

const ScoringRulesEditor = ({ scoringEnabled = true }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState({
    base_points_per_phrase: 100,
    difficulty_multipliers: {
      very_easy: 0.8,
      easy: 1.0,
      medium: 1.2,
      hard: 1.5,
      very_hard: 2.0,
    },
    time_bonus: {
      max_ratio: 0.3,
      target_times_seconds: {
        very_easy: 240,
        easy: 300,
        medium: 600,
        hard: 900,
        very_hard: 1200,
      },
    },
    completion_bonus_points: 200,
    hint_penalty_per_hint: 75,
  });
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    loadScoringRules();
  }, []);

  const loadScoringRules = async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(
        `${API_ENDPOINTS.ADMIN}/settings/scoring-rules`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setRules(response.data);
    } catch (error) {
      console.error("Failed to load scoring rules:", error);
      showNotification(
        t("admin.scoringRules.loadError", "Failed to load scoring rules"),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const saveScoringRules = async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) return;

    try {
      setSaving(true);

      await axios.put(`${API_ENDPOINTS.ADMIN}/settings/scoring-rules`, rules, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      showNotification(
        t(
          "admin.scoringRules.saveSuccess",
          "Scoring rules updated successfully"
        ),
        "success"
      );

      // Reload to ensure we have the latest values
      await loadScoringRules();
    } catch (error) {
      console.error("Failed to save scoring rules:", error);
      showNotification(
        t("admin.scoringRules.saveError", "Failed to save scoring rules"),
        "error"
      );
    } finally {
      setSaving(false);
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

  const handleBasePointsChange = (event) => {
    const value = parseInt(event.target.value) || 0;
    setRules((prev) => ({ ...prev, base_points_per_phrase: value }));
  };

  const handleCompletionBonusChange = (event) => {
    const value = parseInt(event.target.value) || 0;
    setRules((prev) => ({ ...prev, completion_bonus_points: value }));
  };

  const handleHintPenaltyChange = (event) => {
    const value = parseInt(event.target.value) || 0;
    setRules((prev) => ({ ...prev, hint_penalty_per_hint: value }));
  };

  const handleMaxTimeBonusChange = (event) => {
    const value = parseFloat(event.target.value) || 0;
    setRules((prev) => ({
      ...prev,
      time_bonus: {
        ...prev.time_bonus,
        max_ratio: value,
      },
    }));
  };

  const handleDifficultyMultiplierChange = (difficulty) => (event) => {
    const value = parseFloat(event.target.value) || 0;
    setRules((prev) => ({
      ...prev,
      difficulty_multipliers: {
        ...prev.difficulty_multipliers,
        [difficulty]: value,
      },
    }));
  };

  const handleTargetTimeChange = (difficulty) => (event) => {
    const value = parseInt(event.target.value) || 0;
    setRules((prev) => ({
      ...prev,
      time_bonus: {
        ...prev.time_bonus,
        target_times_seconds: {
          ...prev.time_bonus.target_times_seconds,
          [difficulty]: value,
        },
      },
    }));
  };

  const difficultyLevels = [
    { key: "very_easy", label: t("difficultyLevel.very_easy", "Very Easy") },
    { key: "easy", label: t("difficultyLevel.easy", "Easy") },
    { key: "medium", label: t("difficultyLevel.medium", "Medium") },
    { key: "hard", label: t("difficultyLevel.hard", "Hard") },
    { key: "very_hard", label: t("difficultyLevel.very_hard", "Very Hard") },
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 3, opacity: scoringEnabled ? 1 : 0.6 }}>
      <Typography variant="h6" gutterBottom color="primary">
        {t("admin.scoringRules.title", "Scoring Rules Configuration")}
      </Typography>

      <Typography variant="body2" color="text.secondary" paragraph>
        {t(
          "admin.scoringRules.description",
          "Configure how points are calculated for games. Changes will apply to all new games."
        )}
      </Typography>

      {!scoringEnabled && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t(
            "admin.scoringRules.disabledWarning",
            "Scoring system is currently disabled. Enable it above to modify scoring rules."
          )}
        </Alert>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Base Settings */}
      <Box mb={3}>
        <Typography variant="subtitle1" gutterBottom fontWeight="bold">
          {t("admin.scoringRules.baseSettings", "Base Settings")}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label={t(
                "admin.scoringRules.basePoints",
                "Base Points per Phrase"
              )}
              type="number"
              value={rules.base_points_per_phrase}
              onChange={handleBasePointsChange}
              inputProps={{ min: 0, step: 10 }}
              disabled={!scoringEnabled}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label={t(
                "admin.scoringRules.completionBonus",
                "Completion Bonus"
              )}
              type="number"
              value={rules.completion_bonus_points}
              onChange={handleCompletionBonusChange}
              inputProps={{ min: 0, step: 10 }}
              disabled={!scoringEnabled}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label={t(
                "admin.scoringRules.hintPenalty",
                "Hint Penalty per Hint"
              )}
              type="number"
              value={rules.hint_penalty_per_hint}
              onChange={handleHintPenaltyChange}
              inputProps={{ min: 0, step: 5 }}
              disabled={!scoringEnabled}
            />
          </Grid>
        </Grid>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Difficulty Multipliers */}
      <Box mb={3}>
        <Typography variant="subtitle1" gutterBottom fontWeight="bold">
          {t(
            "admin.scoringRules.difficultyMultipliers",
            "Difficulty Multipliers"
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          {t(
            "admin.scoringRules.multipliersHelp",
            "Higher multipliers give more bonus points for harder difficulties"
          )}
        </Typography>
        <Grid container spacing={2}>
          {difficultyLevels.map(({ key, label }) => (
            <Grid item xs={12} sm={6} md={2.4} key={key}>
              <TextField
                fullWidth
                label={label}
                type="number"
                value={rules.difficulty_multipliers[key]}
                onChange={handleDifficultyMultiplierChange(key)}
                inputProps={{ min: 0, step: 0.1 }}
                disabled={!scoringEnabled}
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Time Bonus Settings */}
      <Box mb={3}>
        <Typography variant="subtitle1" gutterBottom fontWeight="bold">
          {t("admin.scoringRules.timeBonus", "Time Bonus Settings")}
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          {t(
            "admin.scoringRules.timeBonusHelp",
            "Players get bonus points for completing within target times"
          )}
        </Typography>

        <Box mb={2}>
          <TextField
            label={t(
              "admin.scoringRules.maxTimeBonusRatio",
              "Max Time Bonus Ratio"
            )}
            type="number"
            value={rules.time_bonus.max_ratio}
            onChange={handleMaxTimeBonusChange}
            inputProps={{ min: 0, max: 1, step: 0.05 }}
            helperText={t(
              "admin.scoringRules.maxRatioHelp",
              "Maximum percentage of base score as time bonus (0-1)"
            )}
            sx={{ maxWidth: 300 }}
            disabled={!scoringEnabled}
          />
        </Box>

        <Typography variant="body2" gutterBottom fontWeight="medium">
          {t("admin.scoringRules.targetTimes", "Target Times (seconds)")}
        </Typography>
        <Grid container spacing={2}>
          {difficultyLevels.map(({ key, label }) => (
            <Grid item xs={12} sm={6} md={2.4} key={key}>
              <TextField
                fullWidth
                label={label}
                type="number"
                value={rules.time_bonus.target_times_seconds[key]}
                onChange={handleTargetTimeChange(key)}
                inputProps={{ min: 0, step: 30 }}
                disabled={!scoringEnabled}
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Save Button */}
      <Box display="flex" justifyContent="flex-end" gap={2}>
        <Button
          variant="outlined"
          onClick={loadScoringRules}
          disabled={saving || !scoringEnabled}
        >
          {t("common.reset", "Reset")}
        </Button>
        <Button
          variant="contained"
          onClick={saveScoringRules}
          disabled={saving || !scoringEnabled}
          startIcon={saving && <CircularProgress size={20} />}
        >
          {t("common.save", "Save Changes")}
        </Button>
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

export default ScoringRulesEditor;
