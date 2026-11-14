export function createCanvas({ frame, overlay, inset, insetImage, sweep, targets, onSeek }) {
  const place = (element, values) => Object.assign(element.style, values);
  const relative = (value, size) => (100 * value / size) + "%";
  const regionOutline = document.createElement("div");
  regionOutline.className = "overlay-region";
  const bandOutline = document.createElement("div");
  bandOutline.className = "overlay-band";
  regionOutline.append(bandOutline);
  overlay.append(regionOutline);
  let active;
  const areas = new Map();

  function alignInset() {
    if (!active || !inset.clientWidth || !inset.clientHeight) return;
    const { region, counts } = active;
    const [x0, y0, x1, y1] = region.box;
    const width = x1 - x0, height = y1 - y0;
    const view = Math.min(inset.clientWidth / width, inset.clientHeight / height);
    place(sweep, {
      left: (inset.clientWidth - width * view) / 2 + counts.start * view + "px",
      top: (inset.clientHeight - height * view) / 2 + "px",
      width: (counts.end - counts.start) * view + "px",
      height: height * view + "px",
    });
  }

  const resize = new ResizeObserver(alignInset);
  resize.observe(inset);
  inset.addEventListener("click", (event) => {
    if (!active) return;
    const [x0, y0, x1, y1] = active.region.box;
    const position = inset.getBoundingClientRect();
    const width = x1 - x0, height = y1 - y0;
    const scale = Math.min(position.width / width, position.height / height);
    const x = (event.clientX - position.left - (position.width - width * scale) / 2) / scale;
    const y = (event.clientY - position.top - (position.height - height * scale) / 2) / scale;
    if (y < 0 || y >= height) return;
    const index = active.region.bands.findIndex(({ start, end }) => x >= start && x < end);
    if (index >= 0) onSeek(index);
  });
  return {
    placeRegions(source, translate, select) {
      for (const region of source.regions) {
        if (!areas.has(region.id)) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "inset-target";
          button.dataset.region = region.id;
          const label = document.createElement("span");
          label.setAttribute("aria-hidden", "true");
          button.append(label);
          button.addEventListener("click", () => select(region));
          targets.append(button);
          areas.set(region.id, button);
        }
        const button = areas.get(region.id), [x0, y0, x1, y1] = region.box;
        button.firstElementChild.textContent = translate(region.id);
        button.setAttribute("aria-label", translate(region.id));
        place(button, {
          left: relative(x0, source.width), top: relative(y0, source.height),
          width: relative(x1 - x0, source.width), height: relative(y1 - y0, source.height),
        });
      }
    },
    render(event, source) {
      const { region, counts, index } = event;
      const was = active?.region.id;
      active = event;
      const [x0, y0, x1, y1] = region.box;
      place(regionOutline, {
        left: relative(x0, source.width), top: relative(y0, source.height),
        width: relative(x1 - x0, source.width), height: relative(y1 - y0, source.height),
      });
      place(bandOutline, { left: relative(counts.start, x1 - x0), width: relative(counts.end - counts.start, x1 - x0) });
      if (was !== region.id) insetImage.src = new URL("./media/" + region.image, import.meta.url);
      for (const [id, button] of areas) button.setAttribute("aria-pressed", String(id === region.id));
      const id = region.id + ":" + (index + 1);
      frame.dataset.event = inset.dataset.event = id;
      alignInset();
    },
  };
}
