// Spectrogram drawn from the real AnalyserNode on the transport output. The page never fabricates a signal: with no
// analyser or a silent signal, a column of background colour is drawn.

export function spectrogramColor(value) {
  // value 0..255 -> dark teal to amber
  const t = value / 255;
  if (t < 0.02) return "rgb(5,11,18)";
  const r = Math.round(20 + 235 * t ** 1.4);
  const g = Math.round(40 + 170 * t);
  const b = Math.round(60 + 120 * (1 - t));
  return `rgb(${r},${g},${b})`;
}

/** Scrolls the canvas left by `step` pixels and draws one new column from the analyser's frequency data. */
export function drawSpectrogramColumn(canvas, analyser, { maxHz = 4000, step = 2 } = {}) {
  const context = canvas.getContext("2d");
  if (!context) return false;
  const { width, height } = canvas;
  context.drawImage(canvas, -step, 0);
  context.fillStyle = "rgb(5,11,18)";
  context.fillRect(width - step, 0, step, height);
  const bins = analyser?.frequencyBinCount ?? 0;
  if (!bins || !analyser.getByteFrequencyData) return false;
  const data = new Uint8Array(bins);
  analyser.getByteFrequencyData(data);
  const nyquist = (analyser.context?.sampleRate ?? 48000) / 2;
  const top = Math.min(bins, Math.floor((maxHz / nyquist) * bins));
  let live = false;
  for (let y = 0; y < height; y++) {
    const bin = Math.min(top - 1, Math.floor(((height - 1 - y) / height) * top));
    const value = data[bin];
    if (value > 4) live = true;
    context.fillStyle = spectrogramColor(value);
    context.fillRect(width - step, y, step, 1);
  }
  return live;
}
