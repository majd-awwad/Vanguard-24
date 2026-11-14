// Taps the real Web Audio output for the hero waveform without touching the shared transport.
//
// createTransport() accepts a createContext function and routes its master gain to context.destination. The
// context returned here reports an AnalyserNode as its destination; the analyser is wired to the real
// destination, so audio is unchanged and the waveform shows exactly what is playing.

export function createAudioTap(AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext) {
  let analyser = null;
  return {
    createContext() {
      if (typeof AudioContextClass !== "function") throw new Error("Web Audio is not available.");
      const context = new AudioContextClass();
      const output = context.destination;
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.55;
      analyser.connect(output);
      Object.defineProperty(context, "destination", { value: analyser, configurable: true });
      return context;
    },
    get analyser() {
      return analyser;
    },
  };
}

/** True when the samples are a flat line (silence), so nothing is drawn as if it were a signal. */
export function isSilent(samples) {
  for (const sample of samples) if (Math.abs(sample - 128) > 1) return false;
  return true;
}

/** Draws the analyser's time-domain signal; a quiet or missing analyser draws an honest flat line. */
export function drawWaveform(canvas, analyser, { color = "#5eead4", lineWidth = 2 } = {}) {
  const context = canvas.getContext("2d");
  if (!context) return false;
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  const samples = new Uint8Array(analyser?.fftSize ?? 0);
  analyser?.getByteTimeDomainData?.(samples);
  const live = samples.length > 0 && !isSilent(samples);
  context.lineWidth = lineWidth;
  context.lineJoin = "round";
  context.strokeStyle = color;
  context.globalAlpha = live ? 1 : 0.35;
  context.beginPath();
  if (!live) {
    context.moveTo(0, height / 2);
    context.lineTo(width, height / 2);
  } else {
    const step = Math.max(1, Math.floor(samples.length / width));
    for (let x = 0; x < width; x++) {
      const y = (samples[Math.min(samples.length - 1, x * step)] / 255) * height;
      if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
  }
  context.stroke();
  context.globalAlpha = 1;
  return live;
}
