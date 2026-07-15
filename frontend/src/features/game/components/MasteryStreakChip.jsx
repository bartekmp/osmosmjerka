import { Chip, Stack } from "@mui/material";

/**
 * Compact mastery/streak summary for the main game screen — same visual language as
 * ReviewSprint's StatsRow, so the progression system reads consistently everywhere
 * it's shown.
 */
export default function MasteryStreakChip({ stats, t }) {
  if (!stats) return null;

  return (
    <Stack direction="row" spacing={1} sx={{ justifyContent: "center", flexWrap: "wrap" }}>
      {stats.streak > 0 && <Chip size="small" color="primary" label={`🔥 ${stats.streak}`} />}
      <Chip size="small" color="success" label={`${t("review.mastered", "Mastered")}: ${stats.mastered ?? 0}`} />
    </Stack>
  );
}
