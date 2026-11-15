// Guided Voice / Pure Sonification speech manager. speechSynthesis is an optional enhancement: with no voice for the
// current language (or no API) text goes to an aria-live region and stays visible. In Pure Sonification nothing is ever
// spoken automatically (explicit user requests still work). Movement announcements wait until the cursor settles; stale
// speech is cancelled when the context changes; data sound is ducked while speaking and restored smoothly.

export const GUIDED = "GUIDED_VOICE";
export const PURE = "PURE_SONIFICATION";
export const SETTLE_MS = 550;
export const DUCK_FACTOR = 0.35;
export const DUCK_RAMP_MS = 300;

export function hasVoice(voices, language) {
  return (voices ?? []).some((voice) => String(voice.lang).toLowerCase().startsWith(language));
}

export function createSpeech({
  synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance, language = () => "en", liveRegion = null,
  setTimer = (f, ms) => setTimeout(f, ms), clearTimer = (id) => clearTimeout(id), onState = () => {}, onDuck = () => {}, onText = () => {},
} = {}) {
  let mode = GUIDED;
  let pending = null;
  let token = 0;
  let speechVolume = 1;
  let state = synth && Utterance ? "IDLE" : "UNAVAILABLE";
  let ducked = false;

  const setState = (next) => { if (state !== next) { state = next; onState(next); } };
  const voiceAvailable = () => Boolean(synth && Utterance) && hasVoice(synth.getVoices?.(), language());

  function duck(on) { if (ducked !== on) { ducked = on; onDuck(on); } }

  function show(text) {
    onText(text);
    if (liveRegion) liveRegion.textContent = text;
  }

  function cancel() {
    token++;
    clearTimer(pending);
    pending = null;
    try { synth?.cancel?.(); } catch { /* nothing speaking */ }
    duck(false);
    if (state === "SPEAKING") setState("IDLE");
  }

  function speakNow(input) {
    const text = typeof input === "function" ? input() : input;
    token++;
    const mine = token;
    show(text);
    if (!voiceAvailable()) { setState(synth && Utterance ? "IDLE" : "UNAVAILABLE"); return false; }
    try { synth.cancel?.(); } catch { /* ignore */ }
    const utterance = new Utterance(text);
    utterance.lang = language();
    utterance.volume = speechVolume;
    utterance.onstart = () => { if (mine !== token) return; setState("SPEAKING"); duck(true); };
    const done = () => { if (mine !== token) return; setState("IDLE"); duck(false); };
    utterance.onend = done;
    utterance.onerror = done;
    synth.speak(utterance);
    return true;
  }

  return {
    get mode() { return mode; },
    get state() { return state; },
    get ducked() { return ducked; },
    get voiceAvailable() { return voiceAvailable(); },
    setSpeechVolume(value) { speechVolume = Math.min(1, Math.max(0, value)); },
    /** Switching modes cancels speech immediately. Entering Guided does not speak by itself. */
    setMode(next) { if (next !== GUIDED && next !== PURE) return; mode = next; cancel(); },
    /** Automatic announcements (cursor moved, selection settled). Never speaks in Pure Sonification. */
    announce(text, { settle = true } = {}) {
      if (mode !== GUIDED) return false;
      token++;
      clearTimer(pending);
      try { synth?.cancel?.(); } catch { /* ignore */ }
      duck(false);
      if (!settle) return speakNow(text);
      const mine = token;
      pending = setTimer(() => { pending = null; if (mine === token && mode === GUIDED) speakNow(text); }, SETTLE_MS);
      return true;
    },
    /** Explicit request (explain, what can I do here): works in both modes. */
    say(text) { clearTimer(pending); pending = null; return speakNow(text); },
    /** Context changed (tab, dataset, finding): drop anything pending or speaking. */
    cancel,
  };
}
