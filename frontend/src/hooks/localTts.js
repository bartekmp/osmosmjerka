import logger from "@shared/utils/logger";

/**
 * Wrapper around @mintplex-labs/piper-tts-web — Piper VITS neural voices running fully
 * in the browser (ONNX Runtime + espeak-ng phonemizer, both WASM). Voice models are
 * downloaded on the user's opt-in and cached in the browser (OPFS); nothing runs on the
 * server and no OS voice is used.
 *
 * The engine (a few MB of WASM/JS) is loaded via dynamic import ONLY when first needed,
 * so it never bloats the main bundle or the review page for users who don't use audio.
 *
 * Voice IDs look like "pl_PL-gosia-medium" / "hr_HR-...". We match them to a language
 * set's BCP-47 `target_lang` (e.g. "pl-PL") by primary subtag.
 */

let enginePromise = null;
function getEngine() {
  if (!enginePromise) enginePromise = import("@mintplex-labs/piper-tts-web");
  return enginePromise;
}

export function isLocalTtsSupported() {
  return (
    typeof window !== "undefined" &&
    typeof WebAssembly !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.storage
  );
}

/** Primary subtag of a BCP-47 or Piper lang tag: "pl-PL" / "pl_PL" / "pl" -> "pl". */
export function primarySubtag(lang) {
  return (lang || "").toLowerCase().split(/[-_]/)[0];
}

/** Does a Piper voiceId (e.g. "pl_PL-gosia-medium") belong to `lang` (e.g. "pl-PL")? */
export function voiceMatchesLang(voiceId, lang) {
  if (!voiceId || !lang) return false;
  return primarySubtag(voiceId) === primarySubtag(lang);
}

// Lightweight localStorage mirror of downloaded voice IDs, so the listen button can
// decide whether to show WITHOUT importing the heavy engine. The engine's OPFS store
// remains the source of truth; this is just a cheap hint kept in sync on download/remove.
const MIRROR_KEY = "osmosmjerkaLocalVoices";

export function cachedInstalledVoices() {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setCachedInstalledVoices(ids) {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(ids || []));
  } catch {
    // ignore storage errors
  }
}

/** First installed voice for a language, read from the cheap localStorage mirror. */
export function installedVoiceForLang(lang) {
  return cachedInstalledVoices().find((id) => voiceMatchesLang(id, lang)) || null;
}

function voiceIdsFrom(voices) {
  if (!voices) return [];
  if (Array.isArray(voices)) {
    return voices.map((v) => (typeof v === "string" ? v : v.key || v.id)).filter(Boolean);
  }
  return Object.keys(voices);
}

/** All installable Piper voice IDs for a language (from the engine's catalog). */
export async function listVoicesForLang(lang) {
  const tts = await getEngine();
  return voiceIdsFrom(await tts.voices()).filter((id) => voiceMatchesLang(id, lang));
}

/** Voice IDs already downloaded and cached in this browser. */
export async function storedVoices() {
  const tts = await getEngine();
  return (await tts.stored()) || [];
}

export async function downloadVoice(voiceId, onProgress) {
  const tts = await getEngine();
  return tts.download(voiceId, onProgress);
}

export async function removeVoice(voiceId) {
  const tts = await getEngine();
  return tts.remove(voiceId);
}

let currentAudio = null;

/** Synthesize `text` with `voiceId` and play it. Returns once playback has started. */
export async function speak(text, voiceId) {
  if (!text || !voiceId) return;
  try {
    const tts = await getEngine();
    const wav = await tts.predict({ text, voiceId });
    const url = URL.createObjectURL(wav);
    if (currentAudio) currentAudio.pause();
    currentAudio = new window.Audio(url);
    currentAudio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
    await currentAudio.play();
  } catch (error) {
    logger.error("Local TTS failed:", error);
  }
}
