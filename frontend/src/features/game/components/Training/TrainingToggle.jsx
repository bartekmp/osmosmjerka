import PsychologyIcon from "@mui/icons-material/Psychology";
import { Box, FormControlLabel, Switch, Tooltip, Typography } from "@mui/material";

/**
 * Opt-out toggle for recall tracking. On by default for logged-in users (rates recall
 * after each word to build spaced-repetition mastery/streak); turning it off restores
 * plain, untracked play — translations visible, no rating prompts.
 */
export default function TrainingToggle({ checked, onChange, t }) {
  return (
    <Tooltip
      title={t(
        "training.tooltip",
        "Rate your recall after each word to build spaced-repetition memory. Turn off for casual play."
      )}
      arrow
    >
      <FormControlLabel
        sx={{ m: 0 }}
        control={<Switch size="small" checked={checked} onChange={(e) => onChange(e.target.checked)} />}
        label={
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <PsychologyIcon fontSize="small" />
            <Typography variant="body2">{t("training.mode", "Track my learning progress")}</Typography>
          </Box>
        }
      />
    </Tooltip>
  );
}
