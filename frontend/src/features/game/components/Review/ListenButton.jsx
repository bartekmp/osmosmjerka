import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { IconButton, Tooltip } from "@mui/material";
import { useSpeech } from "../../../../hooks/useSpeech";

/**
 * A speaker button that pronounces `text` in `lang` (BCP-47) via the Web Speech API.
 * Renders nothing unless TTS is available and a voice for `lang` exists on this device.
 */
export default function ListenButton({ text, lang, t, size = "small" }) {
  const { speak, isLangSupported } = useSpeech();
  if (!text || !lang || !isLangSupported(lang)) return null;
  const label = t("review.listen", "Listen");
  return (
    <Tooltip title={label} arrow>
      <IconButton size={size} onClick={() => speak(text, lang)} aria-label={label}>
        <VolumeUpIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
  );
}
