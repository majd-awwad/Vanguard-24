export function drawProfile(canvas, samples = [], activeIndex = -1) {
  const box = canvas.getBoundingClientRect();
  const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
  const width = Math.max(1, box.width);
  const height = Math.max(1, box.height);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.strokeStyle = "rgba(231, 235, 226, .22)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, height / 2);
  context.lineTo(width, height / 2);
  context.stroke();
  if (!samples.length) return;
  const bar = Math.max(1.5, width / samples.length);
  samples.forEach((sample, index) => {
    const x = index / samples.length * width;
    const magnitude = sample.visualMagnitude ?? 0;
    if (sample.changeDirection === "no-signal") return;
    const annual = sample.changeDirection === "annual-brightness";
    const increase = annual || sample.changeDirection === "increase";
    const stable = sample.changeDirection === "stable";
    const length = Math.max(2, magnitude * (height * 0.44));
    context.fillStyle = stable ? "rgba(238, 238, 226, .72)" : increase ? "rgba(168, 137, 255, .88)" : "rgba(245, 165, 86, .88)";
    context.fillRect(x, increase || stable ? height / 2 - length : height / 2, bar, length);
  });
  if (activeIndex >= 0) {
    const x = (activeIndex + 0.5) / samples.length * width;
    context.strokeStyle = "#fff";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x, 2);
    context.lineTo(x, height - 2);
    context.stroke();
  }
}
