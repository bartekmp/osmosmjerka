import { useCallback, useEffect, useState } from "react";

const isSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;
const norm = (s) => (s || "").toLowerCase().replace("_", "-");

/**
 * Client-side text-to-speech via the Web Speech API — free, no backend. Voice
 * availability is per-OS (Polish is well supported, Croatian is spotty), so callers
 * should gate the UI on `isLangSupported(lang)` to degrade gracefully.
 */
export function useSpeech() {
  const supported = isSupported();
  const [voices, setVoices] = useState(() => (supported ? window.speechSynthesis.getVoices() : []));

  useEffect(() => {
    if (!supported) return undefined;
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices() || []);
    load(); // voices may already be available
    synth.addEventListener("voiceschanged", load); // ...or arrive asynchronously
    return () => synth.removeEventListener("voiceschanged", load);
  }, [supported]);

  // Match a voice by exact BCP-47, then by primary subtag (e.g. "pl" matches "pl-PL").
  const findVoice = useCallback(
    (lang) => {
      if (!lang) return null;
      const want = norm(lang);
      const base = want.split("-")[0];
      return (
        voices.find((v) => norm(v.lang) === want) ||
        voices.find((v) => norm(v.lang).split("-")[0] === base) ||
        null
      );
    },
    [voices]
  );

  const isLangSupported = useCallback((lang) => supported && !!findVoice(lang), [supported, findVoice]);

  const speak = useCallback(
    (text, lang) => {
      if (!supported || !text) return;
      const synth = window.speechSynthesis;
      synth.cancel(); // stop anything already speaking
      const utterance = new window.SpeechSynthesisUtterance(text);
      if (lang) utterance.lang = lang;
      const voice = findVoice(lang);
      if (voice) utterance.voice = voice;
      synth.speak(utterance);
    },
    [supported, findVoice]
  );

  return { supported, speak, isLangSupported };
}
