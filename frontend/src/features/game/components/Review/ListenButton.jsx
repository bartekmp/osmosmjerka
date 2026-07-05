import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { IconButton, Tooltip } from "@mui/material";
import { installedVoiceForLang, speak, warmup } from "../../../../hooks/localTts";

/**
 * Speaker button using an in-browser Piper voice. Shows only when a voice for `lang`
 * has already been downloaded (checked via the cheap localStorage mirror, so the heavy
 * engine is not loaded just to render). The engine loads lazily on click.
 */
export default function ListenButton({ text, lang, t, size = "small" }) {
  const voiceId = lang ? installedVoiceForLang(lang) : null;
  if (!text || !voiceId) return null;
  const label = t("review.listen", "Listen");
  return (
    <Tooltip title={label} arrow>
      <IconButton
        size={size}
        onClick={() => speak(text, voiceId)}
        onPointerEnter={() => warmup(voiceId)}
        onFocus={() => warmup(voiceId)}
        aria-label={label}
      >
        <VolumeUpIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
  );
}
