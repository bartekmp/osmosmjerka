import PsychologyIcon from "@mui/icons-material/Psychology";
import { Box, FormControlLabel, Switch, Tooltip, Typography } from "@mui/material";

/**
 * Toggle for Training mode. Shown only to logged-in users (reviews are per-account).
 * When on, the player rates recall after each word to build spaced-repetition memory.
 */
export default function TrainingToggle({ checked, onChange, t }) {
  return (
    <Tooltip
      title={t("training.tooltip", "Rate your recall after each word to build spaced-repetition memory")}
      arrow
    >
      <FormControlLabel
        sx={{ m: 0 }}
        control={<Switch size="small" checked={checked} onChange={(e) => onChange(e.target.checked)} />}
        label={
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <PsychologyIcon fontSize="small" />
            <Typography variant="body2">{t("training.mode", "Training mode")}</Typography>
          </Box>
        }
      />
    </Tooltip>
  );
}
