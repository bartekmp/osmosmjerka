import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";
import { useLocalTts } from "../../../../hooks/useLocalTts";

/**
 * Voice-pack manager for a language: list installable Piper voices, download (with
 * progress) / delete, and test-play. Voices are neural TTS that run in the browser and
 * are cached on the device — no OS voice, no server.
 */
export default function VoiceManager({ open, onClose, lang, sampleText, t }) {
  const { status, available, storedForLang, progress, download, remove, speak } = useLocalTts(lang);
  const sample = sampleText || t("review.ttsSample", "This is a test.");
  const showEmpty = status !== "loading" && status !== "unsupported" && available.length === 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("review.voices", "Voice packs")}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t(
            "review.voicesHelp",
            "Download a voice to hear words spoken. Voices run in your browser and are stored on this device."
          )}
        </Typography>

        {status === "unsupported" && (
          <Typography color="text.secondary">
            {t("review.ttsUnsupported", "Your browser can’t run in-browser speech.")}
          </Typography>
        )}
        {status === "loading" && <LinearProgress sx={{ my: 2 }} />}
        {showEmpty && (
          <Typography color="text.secondary">
            {t("review.noVoices", "No downloadable voices for this language.")}
          </Typography>
        )}

        <List>
          {available.map((id) => {
            const installed = storedForLang.includes(id);
            const downloading = progress && progress.id === id;
            return (
              <ListItem
                key={id}
                disableGutters
                secondaryAction={
                  installed ? (
                    <Box>
                      <IconButton aria-label={t("review.listen", "Listen")} onClick={() => speak(sample, id)}>
                        <VolumeUpIcon />
                      </IconButton>
                      <IconButton aria-label={t("delete", "Delete")} onClick={() => remove(id)}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  ) : downloading ? (
                    <CircularProgress
                      size={22}
                      variant={progress.pct ? "determinate" : "indeterminate"}
                      value={progress.pct}
                    />
                  ) : (
                    <IconButton aria-label={t("review.download", "Download")} onClick={() => download(id)}>
                      <DownloadIcon />
                    </IconButton>
                  )
                }
              >
                <ListItemText
                  primary={id}
                  secondary={installed ? t("review.installed", "Installed") : downloading ? `${progress.pct}%` : null}
                />
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("close", "Close")}</Button>
      </DialogActions>
    </Dialog>
  );
}
