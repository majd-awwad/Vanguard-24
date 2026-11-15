import { diffColor, diffS, valueColor, valueT } from "./field.js";

// Value profile for the dock: one bar per step of the loaded scan or route, on the same fixed scales as the map
// colours. Missing or outside steps are drawn as a hatched slot, never as zero.

export function drawValueProfile(canvas, steps = [], kind = "dust", activeIndex = -1) {
  const box = canvas.getBoundingClientRect();
  const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
  const width = Math.max(1, box.width);
  const height = Math.max(1, box.height);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  const change = kind === "change";
  const base = change ? height / 2 : height - 2;
  context.strokeStyle = "rgba(231, 235, 226, .28)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, Math.round(base) + 0.5);
  context.lineTo(width, Math.round(base) + 0.5);
  context.stroke();
  if (!steps.length) return;
  const slot = width / steps.length;
  const bar = Math.max(1, slot - (slot > 4 ? 1 : 0));
  steps.forEach((step, index) => {
    const x = index * slot;
    if (step.value === null || step.value === undefined) {
      context.fillStyle = "rgba(160, 170, 180, .28)";
      context.fillRect(x, 2, bar, height - 4);
      context.strokeStyle = "rgba(215, 222, 230, .5)";
      context.beginPath();
      context.moveTo(x, height - 2);
      context.lineTo(x + bar, 2);
      context.stroke();
      return;
    }
    if (change) {
      const s = diffS(step.value);
      const [r, g, b] = diffColor(step.value);
      context.fillStyle = `rgb(${r}, ${g}, ${b})`;
      const length = Math.max(2, Math.abs(s) * (height / 2 - 3));
      context.fillRect(x, s >= 0 ? base - length : base, bar, s === 0 ? 2 : length);
    } else {
      const [r, g, b] = valueColor(step.value);
      context.fillStyle = `rgb(${r}, ${g}, ${b})`;
      const length = Math.max(2, valueT(step.value) * (height - 6));
      context.fillRect(x, base - length, bar, length);
    }
  });
  if (activeIndex >= 0) {
    const x = (activeIndex + 0.5) * slot;
    context.strokeStyle = "#fff";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x, 1);
    context.lineTo(x, height - 1);
    context.stroke();
  }
}
