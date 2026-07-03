import { Box, Button, Dialog, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";

/**
 * After a word is found/solved in Training mode, ask the player how well they knew it.
 * The three buttons map to SRS grades: again / good / easy. The translation is revealed
 * here (it is hidden during play in word-search training) so the rating follows recall.
 */
export default function TrainingConfidencePrompt({ item, onRate, t }) {
  const open = !!item;
  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ textAlign: "center" }}>
        {t("training.howWell", "How well did you know it?")}
      </DialogTitle>
      <DialogContent>
        {item && (
          <Box sx={{ textAlign: "center", mb: 2 }}>
            <Typography variant="h6">{item.phrase}</Typography>
            <Typography variant="body1" color="text.secondary">
              {item.translation}
            </Typography>
          </Box>
        )}
        <Stack direction="row" spacing={1} sx={{ justifyContent: "center" }}>
          <Button onClick={() => onRate("again")} color="error" variant="outlined">
            ❌ {t("training.didntKnow", "Didn’t know")}
          </Button>
          <Button onClick={() => onRate("good")} color="warning" variant="outlined">
            🤔 {t("training.shaky", "Shaky")}
          </Button>
          <Button onClick={() => onRate("easy")} color="success" variant="contained">
            ✅ {t("training.knewIt", "Knew it")}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
